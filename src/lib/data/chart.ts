import { z } from "zod";
import { type Consulta, consultaSchema, type Par } from "./engine";

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
}

export interface ChartSpec extends z.infer<typeof vizSchema> {
  datos: Par[];
  receta: Receta;
}

export const MAX_DATOS = 24;
export const MAX_DATOS_TORTA = 12;

export const graficarSchema = vizSchema.extend({
  datasetId: z.string().min(1),
  consulta: consultaSchema,
});

export function armarSpec(viz: z.infer<typeof vizSchema>, datos: Par[], receta: Receta): ChartSpec {
  const tope = viz.tipo === "torta" ? MAX_DATOS_TORTA : MAX_DATOS;
  return { ...viz, datos: datos.slice(0, tope), receta };
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
