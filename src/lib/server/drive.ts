/**
 * Google Drive por OAuth (solo fetch: corre en Edge). Scope drive.readonly: lista y
 * baja planillas nativas (exportadas a CSV) y archivos .csv. El refresh token se
 * guarda cifrado en `conexiones_google` y el access token nunca sale del servidor.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { FuenteRemotaError } from "@/lib/data/remote";
import { cifrar, descifrar } from "./cifrado";

export const SCOPES = ["https://www.googleapis.com/auth/drive.readonly", "openid", "email"];
const MIME_SHEET = "application/vnd.google-apps.spreadsheet";
const MAX_BYTES = 5 * 1024 * 1024;

export function driveConfigurado() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.FUENTES_SECRET);
}

function credenciales() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new FuenteRemotaError("Drive no está configurado en este servidor.");
  return { id, secret };
}

export function urlRedirect(origin: string, basePath: string) {
  return `${origin}${basePath}/api/drive/callback`;
}

/** El state va cifrado y atado al usuario: evita CSRF y que una cuenta de Google quede en otro usuario. */
export async function crearState(userId: string) {
  return cifrar(JSON.stringify({ uid: userId, exp: Date.now() + 10 * 60_000, n: crypto.randomUUID() }));
}

export async function verificarState(state: string, userId: string) {
  let datos: { uid?: string; exp?: number };
  try {
    datos = JSON.parse(await descifrar(state));
  } catch {
    throw new FuenteRemotaError("El pedido de autorización no es válido.");
  }
  if (datos.uid !== userId) throw new FuenteRemotaError("La autorización pertenece a otra sesión.");
  if (!datos.exp || datos.exp < Date.now()) throw new FuenteRemotaError("La autorización venció. Probá de nuevo.");
}

export function urlConsentimiento(redirectUri: string, state: string) {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", credenciales().id);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES.join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  return u.toString();
}

async function token(body: Record<string, string>) {
  const { id, secret } = credenciales();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; id_token?: string; error?: string };
  if (!r.ok || !j.access_token) {
    if (j.error === "invalid_grant") throw new FuenteRemotaError("Google revocó el acceso. Volvé a conectar Drive.");
    throw new FuenteRemotaError("Google no entregó el acceso.");
  }
  return j;
}

function emailDeIdToken(idToken?: string): string | null {
  try {
    const payload = idToken?.split(".")[1];
    if (!payload) return null;
    return (JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { email?: string }).email ?? null;
  } catch {
    return null;
  }
}

export async function canjearCodigo(supabase: SupabaseClient, userId: string, code: string, redirectUri: string) {
  const t = await token({ code, grant_type: "authorization_code", redirect_uri: redirectUri });
  if (!t.refresh_token) throw new FuenteRemotaError("Google no devolvió un refresh token. Quitá el acceso de la app en tu cuenta y reintentá.");
  const { error } = await supabase.from("conexiones_google").upsert({
    user_id: userId,
    email: emailDeIdToken(t.id_token),
    refresh_token_cifrado: await cifrar(t.refresh_token),
  });
  if (error) throw new Error(error.message);
}

export async function conexion(supabase: SupabaseClient) {
  const { data } = await supabase.from("conexiones_google").select("email, refresh_token_cifrado").maybeSingle();
  return data;
}

async function accessToken(supabase: SupabaseClient) {
  const c = await conexion(supabase);
  if (!c) throw new FuenteRemotaError("Conectá tu Google Drive primero.");
  const t = await token({ refresh_token: await descifrar(c.refresh_token_cifrado), grant_type: "refresh_token" });
  return t.access_token as string;
}

export interface ArchivoDrive {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

export async function listarArchivos(supabase: SupabaseClient, buscar = ""): Promise<ArchivoDrive[]> {
  const at = await accessToken(supabase);
  const filtro = [`(mimeType='${MIME_SHEET}' or mimeType='text/csv')`, "trashed=false"];
  const b = buscar.trim().replace(/['\\]/g, "");
  if (b) filtro.push(`name contains '${b}'`);
  const u = new URL("https://www.googleapis.com/drive/v3/files");
  u.searchParams.set("q", filtro.join(" and "));
  u.searchParams.set("fields", "files(id,name,mimeType,modifiedTime)");
  u.searchParams.set("orderBy", "modifiedTime desc");
  u.searchParams.set("pageSize", "30");
  const r = await fetch(u, { headers: { Authorization: `Bearer ${at}` }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new FuenteRemotaError(`Drive respondió ${r.status}.`);
  return ((await r.json()) as { files: ArchivoDrive[] }).files;
}

/** Devuelve el CSV del archivo: las planillas nativas se exportan (primera hoja), los .csv se bajan tal cual. */
export async function bajarCsv(supabase: SupabaseClient, fileId: string): Promise<{ nombre: string; csv: string }> {
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) throw new FuenteRemotaError("Id de archivo inválido.");
  const at = await accessToken(supabase);
  const auth = { Authorization: `Bearer ${at}` };
  const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`, { headers: auth });
  if (meta.status === 404) throw new FuenteRemotaError("No encontré ese archivo en tu Drive.");
  if (!meta.ok) throw new FuenteRemotaError(`Drive respondió ${meta.status}.`);
  const m = (await meta.json()) as { name: string; mimeType: string; size?: string };
  if (Number(m.size ?? 0) > MAX_BYTES) throw new FuenteRemotaError("El archivo supera los 5 MB.");
  const url =
    m.mimeType === MIME_SHEET
      ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`
      : m.mimeType === "text/csv"
        ? `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
        : null;
  if (!url) throw new FuenteRemotaError("Solo se pueden importar planillas de Google o archivos .csv.");
  const r = await fetch(url, { headers: auth, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new FuenteRemotaError(`No pude bajar el archivo (${r.status}).`);
  const csv = await r.text();
  if (csv.length > MAX_BYTES) throw new FuenteRemotaError("El archivo supera los 5 MB.");
  return { nombre: m.name.replace(/\.csv$/i, ""), csv };
}

export async function desconectar(supabase: SupabaseClient) {
  const c = await conexion(supabase);
  if (c) {
    const rt = await descifrar(c.refresh_token_cifrado).catch(() => null);
    if (rt) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(rt)}`, { method: "POST" }).catch(() => undefined);
  }
  await supabase.from("conexiones_google").delete().not("user_id", "is", null);
}
