import { z } from "zod";
import { agregar, type Campo, type Consulta, consultaSchema, type Fila, type Par } from "./engine";
import { type PedidoProyeccion, type Proyeccion, proyeccionSchema, proyectar } from "./proyeccion";

export const TIPOS_GRAFICO = ["barras", "torta", "linea", "area"] as const;

export const vizSchema = z.object({
  tipo: z.enum(TIPOS_GRAFICO),
  titulo: z.string().min(1).max(120),
  unidad: z.string().max(40).optional(),
  horizontal: z.boolean().optional(),
});

/** Receta reproducible: con esto un widget recalcula el gráfico sin volver a pasar por el modelo. */
export interface Receta {
  datasetId: string;
  consulta: Consulta;
  proyeccion?: PedidoProyeccion;
}

export const recetaSchema = z.object({
  datasetId: z.string().min(1),
  consulta: consultaSchema,
  proyeccion: proyeccionSchema.optional(),
});

export interface ChartSpec extends z.infer<typeof vizSchema> {
  datos: Par[];
  receta: Receta;
  proyeccion?: Proyeccion;
}

export const MAX_DATOS = 24;
export const MAX_DATOS_TORTA = 12;

export const graficarSchema = vizSchema.extend({
  datasetId: z.string().min(1),
  consulta: consultaSchema,
});

export const proyectarSchema = z.object({
  titulo: z.string().min(1).max(120),
  unidad: z.string().max(40).optional(),
  datasetId: z.string().min(1),
  consulta: consultaSchema,
  ...proyeccionSchema.shape,
});

export function armarSpec(viz: z.infer<typeof vizSchema>, datos: Par[], receta: Receta, proyeccion?: Proyeccion): ChartSpec {
  const tope = viz.tipo === "torta" ? MAX_DATOS_TORTA : MAX_DATOS;
  // En una proyección importa el tramo más reciente, que es el que se continúa.
  if (proyeccion) return { ...viz, datos: datos.slice(-tope), receta, proyeccion };
  return { ...viz, datos: datos.slice(0, tope), receta };
}

/** Ejecuta una receta: lo que usan el chat, los widgets y los reportes para recalcular. */
export function resolverReceta(filas: Fila[], campos: Campo[], receta: Receta): { datos: Par[]; proyeccion?: Proyeccion } {
  if (!receta.proyeccion) return { datos: agregar(filas, campos, receta.consulta) };
  const { historico, proyeccion } = proyectar(filas, campos, receta.consulta, receta.proyeccion);
  return { datos: historico.slice(-MAX_DATOS), proyeccion };
}

export const PRESENTACIONES = ["grafico", "kpi", "tabla"] as const;
export const AGREGADOS_KPI = ["suma", "promedio", "min", "max", "cantidad"] as const;

export const presentacionSchema = z.object({
  tipo: z.enum(PRESENTACIONES).default("grafico"),
  ancho: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  agregado: z.enum(AGREGADOS_KPI).optional(),
});
export type Presentacion = z.infer<typeof presentacionSchema>;

export function calcularKpi(datos: Par[], agregado: Presentacion["agregado"] = "suma"): number | null {
  const v = datos.map((d) => d.valor);
  if (v.length === 0) return null;
  const r =
    agregado === "cantidad"
      ? v.length
      : agregado === "promedio"
        ? v.reduce((a, b) => a + b, 0) / v.length
        : agregado === "min"
          ? Math.min(...v)
          : agregado === "max"
            ? Math.max(...v)
            : v.reduce((a, b) => a + b, 0);
  return Math.round(r * 100) / 100;
}
