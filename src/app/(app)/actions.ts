"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ChartSpec, presentacionSchema, vizSchema } from "@/lib/data/chart";
import { destinoSchema, proximaEjecucion, recurrenciaSchema } from "@/lib/data/programacion";
import { cifrarDestinos, ejecutarProgramacion, emailConfigurado, type FilaProgramacion } from "@/lib/server/envios";
import { type Borrador, generarReporteCon, guardarReporte, redactarReporte, resolverWidgetsCon, type WidgetResuelto } from "@/lib/server/reportes";
import { estiloSchema } from "@/lib/data/estilo";
import { BASE_PATH } from "@/lib/env";
import { headers } from "next/headers";
import { agregar, type Campo, consultaSchema, type Fila, inferirCampos } from "@/lib/data/engine";
import { MAX_FILAS, parsearCsv } from "@/lib/data/csv";
import { FuenteRemotaError, sanearHeaders, validarUrlPublica } from "@/lib/data/remote";
import { cifrar, descifrar } from "@/lib/server/cifrado";
import { type ArchivoDrive, bajarCsv, desconectar, listarArchivos } from "@/lib/server/drive";
import { type ConfigRemota, type Importado, importarApi, importarSheets } from "@/lib/server/remote";
import { type ColeccionWebflow, importarColeccion, listarColecciones, validarToken } from "@/lib/server/webflow";
import { datasetDeEjemplo } from "@/lib/data/sample";
import { cargadorDeDatasets } from "@/lib/server/datasets";
import { requireUser } from "@/lib/supabase/server";

export type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Datasets -------------------------------------------------------------------

const filasSchema = z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_FILAS);

export async function crearDataset(nombre: string, filas: Fila[]): Promise<Resultado<{ id: string }>> {
  const { supabase } = await requireUser();
  const n = z.string().trim().min(1).max(80).safeParse(nombre);
  const f = filasSchema.safeParse(filas);
  if (!n.success) return { ok: false, error: "El nombre tiene que tener entre 1 y 80 caracteres." };
  if (!f.success) return { ok: false, error: `El archivo tiene que tener entre 1 y ${MAX_FILAS} filas.` };
  // Los campos se infieren de nuevo en el servidor: no confiamos en lo que manda el navegador.
  const campos: Campo[] = inferirCampos(f.data);
  const { data, error } = await supabase
    .from("datasets")
    .insert({ nombre: n.data, filas: f.data, campos, cantidad_filas: f.data.length, origen: "csv" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/datos");
  return { ok: true, data: { id: data.id } };
}

export async function cargarEjemplo(): Promise<Resultado> {
  const { supabase } = await requireUser();
  const ej = datasetDeEjemplo();
  const { error } = await supabase.from("datasets").insert({
    nombre: ej.nombre,
    filas: ej.filas,
    campos: ej.campos,
    cantidad_filas: ej.filas.length,
    origen: "ejemplo",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/datos");
  return { ok: true };
}

export async function borrarDataset(id: string): Promise<Resultado> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("datasets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/datos");
  return { ok: true };
}

// Conversaciones -------------------------------------------------------------

export async function borrarConversacion(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("conversaciones").delete().eq("id", id);
  revalidatePath("/chat", "layout");
  redirect("/chat");
}

// Dashboards -----------------------------------------------------------------

export async function crearDashboard(nombre: string): Promise<Resultado<{ id: string }>> {
  const { supabase } = await requireUser();
  const n = z.string().trim().min(1).max(80).safeParse(nombre);
  if (!n.success) return { ok: false, error: "Poné un nombre de hasta 80 caracteres." };
  const { data, error } = await supabase.from("dashboards").insert({ nombre: n.data }).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboards");
  return { ok: true, data: { id: data.id } };
}

export async function borrarDashboard(id: string): Promise<Resultado> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("dashboards").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboards");
  return { ok: true };
}

const guardarWidgetSchema = z.object({
  destino: z.union([z.object({ dashboardId: z.string().uuid() }), z.object({ nuevo: z.string().trim().min(1).max(80) })]),
  titulo: z.string().trim().min(1).max(120),
  viz: vizSchema,
  receta: z.object({ datasetId: z.string().uuid(), consulta: consultaSchema }),
  presentacion: presentacionSchema,
});

/** Guarda un gráfico del chat. Antes re-ejecuta la receta: un widget que no reproduce no se guarda. */
export async function guardarWidget(input: z.input<typeof guardarWidgetSchema>): Promise<Resultado<{ dashboardId: string }>> {
  const { supabase } = await requireUser();
  const p = guardarWidgetSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { destino, titulo, viz, receta, presentacion } = p.data;

  const ds = await cargadorDeDatasets(supabase)(receta.datasetId);
  if (!ds) return { ok: false, error: "El dataset de este gráfico ya no existe." };
  try {
    agregar(ds.filas, ds.campos, receta.consulta);
  } catch (e) {
    return { ok: false, error: `La consulta ya no reproduce: ${(e as Error).message}` };
  }

  let dashboardId: string;
  if ("nuevo" in destino) {
    const r = await crearDashboard(destino.nuevo);
    if (!r.ok || !r.data) return { ok: false, error: r.ok ? "No se pudo crear el dashboard." : r.error };
    dashboardId = r.data.id;
  } else {
    dashboardId = destino.dashboardId;
  }
  const { count } = await supabase.from("widgets").select("id", { count: "exact", head: true }).eq("dashboard_id", dashboardId);
  if ((count ?? 0) >= 24) return { ok: false, error: "Ese dashboard ya tiene 24 widgets." };

  const { error } = await supabase.from("widgets").insert({
    dashboard_id: dashboardId,
    titulo,
    spec: { ...viz, titulo, receta },
    presentacion,
    orden: count ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  await supabase.from("dashboards").update({ updated_at: new Date().toISOString() }).eq("id", dashboardId);
  revalidatePath(`/dashboards/${dashboardId}`);
  revalidatePath("/dashboards");
  return { ok: true, data: { dashboardId } };
}

export async function quitarWidget(id: string, dashboardId: string): Promise<Resultado> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("widgets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboards/${dashboardId}`);
  return { ok: true };
}

export async function actualizarWidget(
  id: string,
  dashboardId: string,
  cambios: { presentacion?: z.input<typeof presentacionSchema>; mover?: -1 | 1 },
): Promise<Resultado> {
  const { supabase } = await requireUser();
  if (cambios.presentacion) {
    const p = presentacionSchema.safeParse(cambios.presentacion);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const { error } = await supabase.from("widgets").update({ presentacion: p.data }).eq("id", id);
    if (error) return { ok: false, error: error.message };
  }
  if (cambios.mover) {
    const { data: ws } = await supabase.from("widgets").select("id, orden").eq("dashboard_id", dashboardId).order("orden");
    const lista = ws ?? [];
    const i = lista.findIndex((w) => w.id === id);
    const j = i + cambios.mover;
    if (i >= 0 && j >= 0 && j < lista.length) {
      [lista[i], lista[j]] = [lista[j], lista[i]];
      await Promise.all(lista.map((w, k) => supabase.from("widgets").update({ orden: k }).eq("id", w.id)));
    }
  }
  revalidatePath(`/dashboards/${dashboardId}`);
  return { ok: true };
}

// Reportes -------------------------------------------------------------------

export type { WidgetResuelto } from "@/lib/server/reportes";

/** Recalcula cada widget con la misma receta que lo creó. Un widget roto no rompe el resto. */
export async function resolverWidgets(dashboardId: string): Promise<WidgetResuelto[]> {
  const { supabase, user } = await requireUser();
  return resolverWidgetsCon(supabase, user.id, dashboardId);
}

export async function generarReporte(dashboardId: string): Promise<Resultado<{ id: string }>> {
  const { supabase, user } = await requireUser();
  try {
    const r = await generarReporteCon(supabase, user.id, dashboardId);
    revalidatePath("/reportes");
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const borradorSchema = z.object({
  titulo: z.string().min(1).max(200),
  contenido: z.string().min(1).max(8000),
  datos: z.array(z.custom<ChartSpec>((x) => typeof x === "object" && x !== null && Array.isArray((x as ChartSpec).datos))).max(24),
  estilo: estiloSchema,
});

/** Vista previa: la IA redacta con el estilo del formulario, sin guardar nada. */
export async function previsualizarReporte(dashboardId: string, estilo: z.input<typeof estiloSchema>): Promise<Resultado<Borrador>> {
  const { supabase, user } = await requireUser();
  const e = estiloSchema.safeParse(estilo);
  if (!e.success) return { ok: false, error: e.error.issues[0].message };
  try {
    return { ok: true, data: await redactarReporte(supabase, user.id, dashboardId, e.data) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function guardarEstiloReporte(dashboardId: string, estilo: z.input<typeof estiloSchema>): Promise<Resultado> {
  const { supabase } = await requireUser();
  const e = estiloSchema.safeParse(estilo);
  if (!e.success) return { ok: false, error: e.error.issues[0].message };
  const { error } = await supabase.from("dashboards").update({ estilo_reporte: e.data }).eq("id", dashboardId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboards/${dashboardId}`);
  return { ok: true };
}

/** Guarda la vista previa tal cual la vio el usuario (sin volver a llamar al modelo). */
export async function guardarBorradorReporte(dashboardId: string, borrador: z.input<typeof borradorSchema>): Promise<Resultado<{ id: string }>> {
  const { supabase, user } = await requireUser();
  const b = borradorSchema.safeParse(borrador);
  if (!b.success) return { ok: false, error: "La vista previa no es válida. Generala de nuevo." };
  try {
    const r = await guardarReporte(supabase, user.id, dashboardId, b.data);
    revalidatePath("/reportes");
    return { ok: true, data: { id: r.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function borrarReporte(id: string): Promise<Resultado> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("reportes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reportes");
  return { ok: true };
}

// Programaciones ---------------------------------------------------------------

const programacionSchema = z.object({
  dashboardId: z.string().uuid(),
  recurrencia: recurrenciaSchema,
  destinos: z.array(destinoSchema).min(1, "Agregá al menos un destino.").max(10),
});

async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${BASE_PATH}`;
}

export async function crearProgramacion(input: z.input<typeof programacionSchema>): Promise<Resultado<{ proxima: string }>> {
  const { supabase } = await requireUser();
  const p = programacionSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { dashboardId, recurrencia: r, destinos } = p.data;
  if (destinos.some((d) => d.canal === "email") && !emailConfigurado()) {
    return { ok: false, error: "El email no está configurado en este servidor. Usá Slack o configurá RESEND_API_KEY." };
  }
  let cifrados: Awaited<ReturnType<typeof cifrarDestinos>>;
  try {
    cifrados = await cifrarDestinos(destinos);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const proxima = proximaEjecucion(r).toISOString();
  const { error } = await supabase.from("programaciones").insert({
    dashboard_id: dashboardId,
    frecuencia: r.frecuencia,
    hora: r.hora,
    dia_semana: r.frecuencia === "semanal" ? r.diaSemana : null,
    dia_mes: r.frecuencia === "mensual" ? r.diaMes : null,
    timezone: r.timezone,
    ...cifrados,
    proxima_ejecucion: proxima,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboards/${dashboardId}`);
  revalidatePath("/reportes");
  return { ok: true, data: { proxima } };
}

export async function alternarProgramacion(id: string, activa: boolean): Promise<Resultado> {
  const { supabase } = await requireUser();
  const { data: p } = await supabase.from("programaciones").select("frecuencia, hora, dia_semana, dia_mes, timezone").eq("id", id).maybeSingle();
  if (!p) return { ok: false, error: "No encontré esa programación." };
  const cambios: Record<string, unknown> = { activa };
  // Al reactivar se recalcula desde ahora: no se disparan las corridas que se perdieron en pausa.
  if (activa) {
    cambios.proxima_ejecucion = proximaEjecucion({
      frecuencia: p.frecuencia,
      hora: p.hora,
      diaSemana: p.dia_semana ?? undefined,
      diaMes: p.dia_mes ?? undefined,
      timezone: p.timezone,
    }).toISOString();
  }
  const { error } = await supabase.from("programaciones").update(cambios).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reportes");
  return { ok: true };
}

export async function borrarProgramacion(id: string): Promise<Resultado> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("programaciones").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reportes");
  return { ok: true };
}

/** "Enviar ahora": misma ejecución que el cron, con la sesión del usuario. No mueve la próxima corrida. */
export async function enviarAhora(id: string): Promise<Resultado<{ enviados: number; errores: string[]; reporteId?: string }>> {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase
    .from("programaciones")
    .select("id, user_id, dashboard_id, frecuencia, hora, dia_semana, dia_mes, timezone, destinos_cifrados, activa")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!p) return { ok: false, error: "No encontré esa programación." };
  try {
    const r = await ejecutarProgramacion(supabase, p as FilaProgramacion, await baseUrl());
    revalidatePath("/reportes");
    if (!r.reporteId) return { ok: false, error: r.errores[0] ?? "No se pudo generar el reporte." };
    return { ok: true, data: { enviados: r.enviados, errores: r.errores, reporteId: r.reporteId } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Fuentes remotas: Google Sheets por link, API REST y Google Drive ---------------

const headersSchema = z.array(z.object({ nombre: z.string().max(100), valor: z.string().max(4000) })).max(10);

async function guardarRemoto(
  nombre: string,
  origen: "sheets" | "api" | "drive" | "webflow",
  datos: Importado,
  config: ConfigRemota,
  secretos: string | null = null,
): Promise<Resultado<{ id: string; truncado: boolean }>> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("datasets")
    .insert({
      nombre: nombre.trim().slice(0, 80) || "Sin nombre",
      filas: datos.filas,
      campos: datos.campos,
      cantidad_filas: datos.filas.length,
      origen,
      config,
      secretos,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/datos");
  return { ok: true, data: { id: data.id, truncado: datos.truncado } };
}

function errorRemoto(e: unknown): { ok: false; error: string } {
  if (e instanceof FuenteRemotaError) return { ok: false, error: e.message };
  console.error("fuente remota", e);
  return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer la fuente." };
}

export async function importarDesdeSheets(link: string, nombre: string): Promise<Resultado<{ id: string; truncado: boolean }>> {
  await requireUser();
  try {
    const datos = await importarSheets(link);
    return guardarRemoto(nombre || "Google Sheet", "sheets", datos, { tipo: "sheets", link: link.trim() });
  } catch (e) {
    return errorRemoto(e);
  }
}

export async function importarDesdeApi(input: {
  nombre: string;
  url: string;
  pathFilas?: string;
  headers?: { nombre: string; valor: string }[];
}): Promise<Resultado<{ id: string; truncado: boolean }>> {
  await requireUser();
  try {
    const h = sanearHeaders(headersSchema.parse(input.headers ?? []));
    const url = validarUrlPublica(input.url).toString();
    const pathFilas = input.pathFilas?.trim() || undefined;
    const datos = await importarApi({ url, pathFilas }, h);
    const secretos = Object.keys(h).length ? await cifrar(JSON.stringify(h)) : null;
    return guardarRemoto(input.nombre || new URL(url).hostname, "api", datos, { tipo: "api", url, pathFilas, headers: Object.keys(h) }, secretos);
  } catch (e) {
    return errorRemoto(e);
  }
}

export async function listarDrive(buscar = ""): Promise<Resultado<ArchivoDrive[]>> {
  const { supabase } = await requireUser();
  try {
    return { ok: true, data: await listarArchivos(supabase, buscar) };
  } catch (e) {
    return errorRemoto(e);
  }
}

export async function importarDesdeDrive(fileId: string): Promise<Resultado<{ id: string; truncado: boolean }>> {
  const { supabase } = await requireUser();
  try {
    const { nombre, csv } = await bajarCsv(supabase, fileId);
    return guardarRemoto(nombre, "drive", parsearCsv(csv), { tipo: "drive", fileId, nombre });
  } catch (e) {
    return errorRemoto(e);
  }
}

export async function coleccionesWebflow(token: string): Promise<Resultado<ColeccionWebflow[]>> {
  await requireUser();
  try {
    return { ok: true, data: await listarColecciones(validarToken(token)) };
  } catch (e) {
    return errorRemoto(e);
  }
}

export async function importarDesdeWebflow(input: { token: string; collectionId: string; coleccion: string; sitio: string }): Promise<Resultado<{ id: string; truncado: boolean }>> {
  await requireUser();
  try {
    const token = validarToken(input.token);
    const datos = await importarColeccion(token, input.collectionId);
    const coleccion = input.coleccion.slice(0, 80);
    const sitio = input.sitio.slice(0, 80);
    return guardarRemoto(`${coleccion} (${sitio})`, "webflow", datos, { tipo: "webflow", collectionId: input.collectionId, coleccion, sitio }, await cifrar(token));
  } catch (e) {
    return errorRemoto(e);
  }
}

export async function desconectarDrive(): Promise<Resultado> {
  const { supabase } = await requireUser();
  await desconectar(supabase);
  revalidatePath("/datos");
  return { ok: true };
}

/** Vuelve a leer la fuente y reemplaza las filas. Los widgets se recalculan solos con los datos nuevos. */
export async function refrescarDataset(id: string): Promise<Resultado<{ filas: number }>> {
  const { supabase } = await requireUser();
  const { data: ds } = await supabase.from("datasets").select("origen, config, secretos").eq("id", id).maybeSingle();
  if (!ds?.config) return { ok: false, error: "Este dataset no tiene una fuente para actualizar." };
  try {
    const cfg = ds.config as ConfigRemota;
    let datos: Importado;
    if (cfg.tipo === "sheets") datos = await importarSheets(cfg.link);
    else if (cfg.tipo === "api") {
      const h = ds.secretos ? (JSON.parse(await descifrar(ds.secretos)) as Record<string, string>) : {};
      datos = await importarApi(cfg, h);
    } else if (cfg.tipo === "webflow") {
      if (!ds.secretos) return { ok: false, error: "Falta el token de Webflow. Volvé a importar la colección." };
      datos = await importarColeccion(await descifrar(ds.secretos), cfg.collectionId);
    } else datos = parsearCsv((await bajarCsv(supabase, cfg.fileId)).csv);
    const { error } = await supabase
      .from("datasets")
      .update({ filas: datos.filas, campos: datos.campos, cantidad_filas: datos.filas.length, actualizado_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/datos");
    return { ok: true, data: { filas: datos.filas.length } };
  } catch (e) {
    return errorRemoto(e);
  }
}
