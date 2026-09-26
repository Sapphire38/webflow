/**
 * Núcleo de reportes, independiente de la sesión: lo usan las Server Actions (cliente
 * del usuario, con RLS) y el cron (service role, sin RLS). Por eso toda consulta filtra
 * por `user_id` explícitamente además de confiar en RLS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { type ChartSpec, calcularKpi, type Presentacion, presentacionSchema } from "@/lib/data/chart";
import { sinCjk } from "@/lib/chat/limpiar";
import { agregar } from "@/lib/data/engine";
import { type Estilo, instruccionesDeEstilo, leerEstilo } from "@/lib/data/estilo";
import { cargadorDeDatasets } from "./datasets";
import { modelo } from "./llm";

export interface WidgetResuelto {
  id: string;
  titulo: string;
  presentacion: Presentacion;
  spec: ChartSpec | null;
  error?: string;
}

export async function resolverWidgetsCon(supabase: SupabaseClient, userId: string, dashboardId: string): Promise<WidgetResuelto[]> {
  const { data: ws } = await supabase
    .from("widgets")
    .select("id, titulo, spec, presentacion")
    .eq("dashboard_id", dashboardId)
    .eq("user_id", userId)
    .order("orden");
  const cargar = cargadorDeDatasets(supabase, userId);
  return Promise.all(
    (ws ?? []).map(async (w): Promise<WidgetResuelto> => {
      const presentacion = presentacionSchema.parse(w.presentacion ?? {});
      try {
        const spec = w.spec as Omit<ChartSpec, "datos">;
        const ds = await cargar(spec.receta.datasetId);
        if (!ds) throw new Error("El dataset fue borrado.");
        const datos = agregar(ds.filas, ds.campos, spec.receta.consulta);
        return { id: w.id, titulo: w.titulo, presentacion, spec: { ...spec, titulo: w.titulo, datos } };
      } catch (e) {
        return { id: w.id, titulo: w.titulo, presentacion, spec: null, error: (e as Error).message };
      }
    }),
  );
}

export class ReporteError extends Error {}

export interface ReporteGenerado {
  id: string;
  titulo: string;
  contenido: string;
  estilo: Estilo;
}

export interface Borrador {
  titulo: string;
  contenido: string;
  datos: ChartSpec[];
  estilo: Estilo;
}

/**
 * Recalcula el dashboard y le pide a la IA el resumen con el estilo dado (o el del
 * dashboard). No guarda nada: la vista previa usa esto tal cual.
 */
export async function redactarReporte(supabase: SupabaseClient, userId: string, dashboardId: string, estiloForzado?: Estilo): Promise<Borrador> {
  const { data: dash } = await supabase
    .from("dashboards")
    .select("id, nombre, estilo_reporte")
    .eq("id", dashboardId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!dash) throw new ReporteError("No encontré ese dashboard.");
  const estilo = estiloForzado ?? leerEstilo(dash.estilo_reporte);
  const widgets = await resolverWidgetsCon(supabase, userId, dashboardId);
  const conDatos = widgets.filter((w) => w.spec);
  if (conDatos.length === 0) throw new ReporteError("El dashboard no tiene widgets con datos para narrar.");

  const contexto = conDatos
    .map((w) => {
      const s = w.spec as ChartSpec;
      const total = calcularKpi(s.datos, "suma");
      const filas = s.datos.map((d) => `  - ${d.etiqueta}: ${d.valor}${s.unidad ? ` ${s.unidad}` : ""}`).join("\n");
      return `### ${w.titulo} (${s.tipo}; suma de todas las categorías: ${total})\n${filas}`;
    })
    .join("\n\n");

  let contenido: string;
  try {
    const { text } = await generateText({
      model: modelo(),
      system: `Escribís el resumen ejecutivo de un reporte en castellano rioplatense. Escribí únicamente en español, sin palabras ni caracteres de otros idiomas. Usá SOLO las cifras provistas, con su unidad. Sin saludos, sin preguntas, sin emojis. Formato: un párrafo de hallazgo principal y después una lista de 3 a 5 puntos con '- '. Podés usar **negrita**. Máximo 200 palabras.\n${instruccionesDeEstilo(estilo)}`,
      prompt: `Reporte: ${dash.nombre}\n\nDatos de esta corrida:\n\n${contexto}`,
    });
    contenido = sinCjk(text).trim();
  } catch (e) {
    throw new ReporteError(`El modelo no pudo escribir el reporte: ${(e as Error).message}`);
  }
  if (!contenido) throw new ReporteError("El modelo devolvió un texto vacío. Probá de nuevo.");
  const titulo = `${dash.nombre} — ${new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`;
  return { titulo, contenido, datos: conDatos.map((w) => w.spec as ChartSpec), estilo };
}

export async function guardarReporte(supabase: SupabaseClient, userId: string, dashboardId: string, b: Borrador): Promise<ReporteGenerado> {
  const { data, error } = await supabase
    .from("reportes")
    .insert({ user_id: userId, dashboard_id: dashboardId, titulo: b.titulo, contenido: b.contenido, datos: b.datos, estilo: b.estilo })
    .select("id")
    .single();
  if (error) throw new ReporteError(error.message);
  return { id: data.id, titulo: b.titulo, contenido: b.contenido, estilo: b.estilo };
}

export async function generarReporteCon(supabase: SupabaseClient, userId: string, dashboardId: string): Promise<ReporteGenerado> {
  return guardarReporte(supabase, userId, dashboardId, await redactarReporte(supabase, userId, dashboardId));
}
