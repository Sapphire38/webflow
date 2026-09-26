/**
 * Estilo propio de un reporte: marca (acento, tipografía, pie) y voz de la narrativa
 * (tono e instrucciones para la IA). Todo validado: el acento termina en CSS y las
 * instrucciones en el prompt.
 */
import { z } from "zod";

export const TONOS = {
  ejecutivo: "Tono ejecutivo: directo, orientado a decisiones, frases cortas.",
  cercano: "Tono cercano: claro y amable, sin jerga, como a un equipo no técnico.",
  tecnico: "Tono técnico: preciso, con el detalle de las métricas y sus variaciones.",
} as const;
export type Tono = keyof typeof TONOS;

export const estiloSchema = z.object({
  acento: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "El color tiene que ser hexadecimal (#rrggbb).")
    .transform((s) => s.toLowerCase())
    .default("#e8501c"),
  tipografia: z.enum(["serif", "sans"]).default("serif"),
  tono: z.enum(["ejecutivo", "cercano", "tecnico"]).default("ejecutivo"),
  pie: z.string().trim().max(160).default(""),
  instrucciones: z.string().trim().max(400).default(""),
});
export type Estilo = z.infer<typeof estiloSchema>;

export const ESTILO_BASE: Estilo = estiloSchema.parse({});

/** Lee un estilo guardado tolerando datos viejos o incompletos. */
export function leerEstilo(x: unknown): Estilo {
  const r = estiloSchema.safeParse(x ?? {});
  return r.success ? r.data : ESTILO_BASE;
}

/** Texto de color legible sobre el acento (negro o blanco según luminancia). */
export function tintaSobre(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#16140f" : "#ffffff";
}

export function instruccionesDeEstilo(e: Estilo): string {
  return [TONOS[e.tono], e.instrucciones && `Indicaciones de la empresa (respetalas si no contradicen usar solo los datos): ${e.instrucciones}`]
    .filter(Boolean)
    .join("\n");
}
