import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";
import { armarSpec, graficarSchema, proyectarSchema } from "@/lib/data/chart";
import { agregar, ConsultaError, consultaSchema } from "@/lib/data/engine";
import { proyectar } from "@/lib/data/proyeccion";
import { cargadorDeDatasets, listarDatasets } from "./datasets";

/** Los errores vuelven al modelo como datos, así puede corregirse en el paso siguiente. */
function comoError(e: unknown) {
  if (e instanceof ConsultaError) return { error: e.message, codigo: e.codigo };
  if (e instanceof z.ZodError) return { error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { error: e instanceof Error ? e.message : "Error desconocido" };
}

export function herramientas(supabase: SupabaseClient) {
  const cargar = cargadorDeDatasets(supabase);
  const dataset = async (id: string) => {
    const d = await cargar(id);
    if (!d) throw new ConsultaError(`No existe el dataset ${id}. Llamá a listar_datasets.`, "DATASET_INEXISTENTE");
    return d;
  };

  return {
    listar_datasets: tool({
      description: "Lista los datasets del usuario con sus campos y tipos. Llamala antes de consultar.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const ds = await listarDatasets(supabase);
          return {
            datasets: ds.map((d) => ({ datasetId: d.id, nombre: d.nombre, filas: d.cantidad_filas, campos: d.campos })),
          };
        } catch (e) {
          return comoError(e);
        }
      },
    }),
    ver_muestra: tool({
      description: "Devuelve algunas filas de un dataset para entender sus valores (no para calcular totales).",
      inputSchema: z.object({ datasetId: z.string(), limite: z.number().int().min(1).max(10).default(5) }),
      execute: async ({ datasetId, limite }) => {
        try {
          const d = await dataset(datasetId);
          return { campos: d.campos, filas: d.filas.slice(0, limite), total: d.cantidad_filas };
        } catch (e) {
          return comoError(e);
        }
      },
    }),
    agregar_dataset: tool({
      description:
        "Calcula totales, promedios, conteos, mínimos o máximos, opcionalmente agrupados por un campo o por período. Toda cuenta pasa por acá: nunca sumes a mano.",
      inputSchema: z.object({ datasetId: z.string(), consulta: consultaSchema }),
      execute: async ({ datasetId, consulta }) => {
        try {
          const d = await dataset(datasetId);
          return { datos: agregar(d.filas, d.campos, consulta), filasTotales: d.cantidad_filas };
        } catch (e) {
          return comoError(e);
        }
      },
    }),
    graficar: tool({
      description:
        "Dibuja un gráfico (barras, torta, linea, area). Recibe la misma consulta que agregar_dataset y calcula los datos del lado del servidor, así el gráfico se puede guardar en un dashboard.",
      inputSchema: graficarSchema,
      execute: async ({ datasetId, consulta, ...viz }) => {
        try {
          const d = await dataset(datasetId);
          const datos = agregar(d.filas, d.campos, consulta);
          return { spec: armarSpec(viz, datos, { datasetId, consulta }), dataset: d.nombre };
        } catch (e) {
          return comoError(e);
        }
      },
    }),
    proyectar: tool({
      description:
        "Proyecta hacia adelante una métrica agrupada por fecha (ej.: costo mensual de los próximos 6 meses) y la dibuja con lo real, lo proyectado y un rango probable del 80%. Acepta escenarios de qué pasaría si (cambios porcentuales, en total o por segmento). Devuelve también el error medido al proyectar los últimos períodos conocidos. Toda cifra futura sale de acá: nunca extrapoles a mano.",
      inputSchema: proyectarSchema,
      execute: async ({ datasetId, consulta, horizonte, escenarios, titulo, unidad }) => {
        try {
          const d = await dataset(datasetId);
          const pedido = { horizonte, ...(escenarios?.length && { escenarios }) };
          const { historico, proyeccion } = proyectar(d.filas, d.campos, consulta, pedido);
          const spec = armarSpec({ tipo: "linea", titulo, unidad }, historico, { datasetId, consulta, proyeccion: pedido }, proyeccion);
          return { spec, dataset: d.nombre };
        } catch (e) {
          return comoError(e);
        }
      },
    }),
    sugerir_preguntas: tool({
      description:
        "Último paso de cada respuesta: propone 2 o 3 preguntas de seguimiento que el usuario puede tocar para seguir el análisis. No devuelve datos.",
      inputSchema: z.object({
        preguntas: z.array(z.string().trim().min(3).max(80)).min(1).max(3).describe("Preguntas cortas, en primera persona del usuario, concretas sobre SUS datos"),
      }),
      execute: async ({ preguntas }) => ({ preguntas: [...new Set(preguntas)].slice(0, 3) }),
    }),
  };
}

export type Herramientas = ReturnType<typeof herramientas>;
