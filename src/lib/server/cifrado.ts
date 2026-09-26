/**
 * AES-256-GCM con Web Crypto (anda en Edge y en Node). Formato `v1.iv.datos` en base64url,
 * con la clave derivada por SHA-256 de FUENTES_SECRET.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const desdeB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function clave(secreto: string) {
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(secreto));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function secretoDeEntorno(): string {
  const s = process.env.FUENTES_SECRET;
  if (!s || s.length < 16) throw new Error("Falta FUENTES_SECRET (mínimo 16 caracteres) para guardar headers de APIs.");
  return s;
}

export async function cifrar(texto: string, secreto = secretoDeEntorno()): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await clave(secreto), enc.encode(texto)));
  return `v1.${b64(iv)}.${b64(datos)}`;
}

export async function descifrar(sobre: string, secreto = secretoDeEntorno()): Promise<string> {
  const [v, iv, datos] = sobre.split(".");
  if (v !== "v1" || !iv || !datos) throw new Error("Formato de secreto desconocido.");
  const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: desdeB64(iv) }, await clave(secreto), desdeB64(datos));
  return dec.decode(plano);
}
