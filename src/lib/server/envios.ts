/**
 * Envío de reportes y ejecución de programaciones. Slack por Incoming Webhook (lo pega
 * el usuario, sin claves nuestras) y email por Resend si hay RESEND_API_KEY.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { aMrkdwn, type Destino, destinoSchema, enmascarar, proximaEjecucion, type Recurrencia } from "@/lib/data/programacion";
import { ESTILO_BASE, type Estilo, tintaSobre } from "@/lib/data/estilo";
import { cifrar, descifrar } from "./cifrado";
import { generarReporteCon, type ReporteGenerado } from "./reportes";

export interface Paquete {
  asunto: string;
  resumen: string;
  link: string;
  estilo?: Estilo;
}

/** Email por Resend (si hay key) o por Selene Hub (`POST /sendEmail`, el mismo contrato que usaba Pyrion). */
function proveedorEmail(): "resend" | "hub" | null {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SELENE_HUB_URL && process.env.SELENE_HUB_API_KEY) return "hub";
  return null;
}

export function emailConfigurado() {
  return proveedorEmail() !== null;
}

function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** HTML mínimo y seguro del resumen (el texto viene del modelo: se escapa todo). */
export function htmlDeResumen(p: Paquete): string {
  const e = p.estilo ?? ESTILO_BASE;
  const fuente = e.tipografia === "serif" ? "Georgia,serif" : "system-ui,sans-serif";
  const cuerpo = escapar(p.resumen)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .split(/\n{2,}/)
    .map((b) =>
      /^- /m.test(b)
        ? `<ul>${b
            .split("\n")
            .filter((l) => l.startsWith("- "))
            .map((l) => `<li>${l.slice(2)}</li>`)
            .join("")}</ul>`
        : `<p>${b.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#16140f;background:#f4f1e8;padding:24px">
<div style="max-width:560px;margin:auto;background:#fbf9f3;border:1px solid #d9d2bf;border-radius:14px;padding:28px">
<p style="color:${e.acento};font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin:0">Insight · Reporte</p>
<h1 style="font-family:${fuente};font-weight:400;font-size:28px;margin:8px 0 16px">${escapar(p.asunto)}</h1>
<div style="line-height:1.6;color:#4a463c">${cuerpo}</div>
<p style="margin-top:24px"><a href="${escapar(p.link)}" style="background:${e.acento};color:${tintaSobre(e.acento)};padding:10px 18px;border-radius:999px;text-decoration:none">Abrir el reporte completo</a></p>${e.pie ? `<p style="color:#807a6b;font-size:12px;margin-top:20px">${escapar(e.pie)}</p>` : ""}
</div></body></html>`;
}

export async function enviar(destino: Destino, p: Paquete, fetcher: typeof fetch = fetch): Promise<void> {
  if (destino.canal === "slack") {
    const r = await fetcher(destino.direccion, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*${p.asunto}*\n\n${aMrkdwn(p.resumen)}\n\n<${p.link}|Abrir en Insight>`,
        unfurl_links: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`Slack respondió ${r.status}${r.status === 404 ? " (webhook inexistente o revocado)" : ""}.`);
    return;
  }
  const proveedor = proveedorEmail();
  if (!proveedor) throw new Error("El envío por email no está configurado (falta RESEND_API_KEY o SELENE_HUB_URL + SELENE_HUB_API_KEY).");
  if (proveedor === "hub") {
    const form = new FormData();
    form.append("data", JSON.stringify({ email: destino.direccion, subject: p.asunto, text: `${p.resumen}\n\n${p.link}`, html: htmlDeResumen(p) }));
    const r = await fetcher(`${(process.env.SELENE_HUB_URL as string).replace(/\/$/, "")}/sendEmail`, {
      method: "POST",
      headers: { "x-api-key": process.env.SELENE_HUB_API_KEY as string },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      const b = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new Error(b.error ?? b.message ?? `Selene Hub respondió ${r.status}.`);
    }
    return;
  }
  const key = process.env.RESEND_API_KEY as string;
  const r = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Insight <onboarding@resend.dev>",
      to: [destino.direccion],
      subject: p.asunto,
      html: htmlDeResumen(p),
      text: `${p.resumen}\n\n${p.link}`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`El proveedor de email respondió ${r.status}.`);
}

export async function cifrarDestinos(destinos: Destino[]) {
  const validos = destinos.map((d) => destinoSchema.parse(d));
  return {
    destinos_publicos: validos.map((d) => ({ canal: d.canal, direccion: enmascarar(d) })),
    destinos_cifrados: await cifrar(JSON.stringify(validos)),
  };
}

export interface FilaProgramacion {
  id: string;
  user_id: string;
  dashboard_id: string;
  frecuencia: Recurrencia["frecuencia"];
  hora: string;
  dia_semana: number | null;
  dia_mes: number | null;
  timezone: string;
  destinos_cifrados: string;
  activa: boolean;
}

export function recurrenciaDe(p: FilaProgramacion): Recurrencia {
  return {
    frecuencia: p.frecuencia,
    hora: p.hora,
    diaSemana: p.dia_semana ?? undefined,
    diaMes: p.dia_mes ?? undefined,
    timezone: p.timezone,
  };
}

export interface ResultadoEjecucion {
  ok: boolean;
  reporteId?: string;
  enviados: number;
  errores: string[];
}

/**
 * Genera el reporte y lo manda a cada destino. Un destino que falla no frena al resto;
 * todo queda registrado en `envios` y el resumen en `programaciones.ultima`.
 */
export async function ejecutarProgramacion(supabase: SupabaseClient, p: FilaProgramacion, baseUrl: string): Promise<ResultadoEjecucion> {
  let reporte: ReporteGenerado;
  const errores: string[] = [];
  let enviados = 0;
  try {
    reporte = await generarReporteCon(supabase, p.user_id, p.dashboard_id);
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("programaciones").update({ ultima: { at: new Date().toISOString(), ok: false, error: msg } }).eq("id", p.id);
    return { ok: false, enviados: 0, errores: [msg] };
  }
  const destinos = JSON.parse(await descifrar(p.destinos_cifrados)) as Destino[];
  const paquete: Paquete = { asunto: reporte.titulo, resumen: reporte.contenido, link: `${baseUrl}/reportes/${reporte.id}`, estilo: reporte.estilo };
  for (const d of destinos) {
    try {
      await enviar(d, paquete);
      enviados++;
      await supabase.from("envios").insert({ user_id: p.user_id, programacion_id: p.id, reporte_id: reporte.id, canal: d.canal, destinatario: enmascarar(d), estado: "enviado" });
    } catch (e) {
      const msg = (e as Error).message;
      errores.push(`${enmascarar(d)}: ${msg}`);
      await supabase.from("envios").insert({ user_id: p.user_id, programacion_id: p.id, reporte_id: reporte.id, canal: d.canal, destinatario: enmascarar(d), estado: "error", error: msg.slice(0, 500) });
    }
  }
  const ok = errores.length === 0;
  await supabase
    .from("programaciones")
    .update({ ultima: { at: new Date().toISOString(), ok, reporteId: reporte.id, enviados, error: ok ? null : errores.join(" · ").slice(0, 1000) } })
    .eq("id", p.id);
  return { ok, reporteId: reporte.id, enviados, errores };
}

/** Pasada del cron: reprograma ANTES de ejecutar (se prefiere perder una corrida a duplicarla). */
export async function correrVencidas(supabase: SupabaseClient, baseUrl: string, ahora = new Date()) {
  const { data } = await supabase
    .from("programaciones")
    .select("id, user_id, dashboard_id, frecuencia, hora, dia_semana, dia_mes, timezone, destinos_cifrados, activa")
    .eq("activa", true)
    .lte("proxima_ejecucion", ahora.toISOString())
    .order("proxima_ejecucion")
    .limit(20);
  const resultados: { id: string; ok: boolean; enviados: number }[] = [];
  for (const p of (data ?? []) as FilaProgramacion[]) {
    const proxima = proximaEjecucion(recurrenciaDe(p), ahora).toISOString();
    const { data: tomada } = await supabase
      .from("programaciones")
      .update({ proxima_ejecucion: proxima })
      .eq("id", p.id)
      .lte("proxima_ejecucion", ahora.toISOString())
      .select("id");
    // Si otra pasada del cron ya la tomó, el update no matchea y se saltea.
    if (!tomada?.length) continue;
    const r = await ejecutarProgramacion(supabase, p, baseUrl);
    resultados.push({ id: p.id, ok: r.ok, enviados: r.enviados });
  }
  return resultados;
}
