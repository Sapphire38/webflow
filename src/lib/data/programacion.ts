/**
 * Recurrencia de reportes: diaria, semanal o mensual a una hora civil en una zona IANA.
 * El cálculo es puro (sin I/O) y maneja cambios de horario (DST) resolviendo el offset
 * de la zona con Intl, igual que la versión original con rrule.
 */
import { z } from "zod";

export const FRECUENCIAS = ["diaria", "semanal", "mensual"] as const;
export const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;

export const recurrenciaSchema = z
  .object({
    frecuencia: z.enum(FRECUENCIAS),
    hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora tiene que ser HH:mm."),
    diaSemana: z.number().int().min(1).max(7).optional(),
    diaMes: z.number().int().min(1).max(28).optional(),
    timezone: z.string().refine(zonaValida, "Zona horaria desconocida."),
  })
  .refine((r) => r.frecuencia !== "semanal" || r.diaSemana, { message: "Elegí el día de la semana.", path: ["diaSemana"] })
  .refine((r) => r.frecuencia !== "mensual" || r.diaMes, { message: "Elegí el día del mes (1 a 28).", path: ["diaMes"] });
export type Recurrencia = z.infer<typeof recurrenciaSchema>;

export function zonaValida(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Fecha civil (año, mes, día, día de semana 1=lunes) de un instante en una zona. */
function civil(instante: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(instante)
      .map((x) => [x.type, x.value]),
  );
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday) + 1;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), dow };
}

/** Offset (ms) de la zona en un instante: hora civil leída como UTC menos el instante real. */
function offset(instante: Date, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instante)
      .map((x) => [x.type, x.value]),
  );
  const comoUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/** Instante UTC de una hora civil en la zona. Dos pasadas para acertar el offset alrededor de un cambio de horario. */
export function instanteDe(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const ingenuo = Date.UTC(y, m - 1, d, hh, mm);
  let t = ingenuo - offset(new Date(ingenuo), tz);
  t = ingenuo - offset(new Date(t), tz);
  return new Date(t);
}

/** Próxima ejecución estrictamente posterior a `desde`. */
export function proximaEjecucion(r: Recurrencia, desde: Date = new Date()): Date {
  const [hh, mm] = r.hora.split(":").map(Number);
  const hoy = civil(desde, r.timezone);
  // Recorremos días civiles desde hoy: alcanza con 62 para cubrir cualquier mensual.
  for (let i = 0; i < 62; i++) {
    const base = new Date(Date.UTC(hoy.y, hoy.m - 1, hoy.d + i));
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth() + 1;
    const d = base.getUTCDate();
    const dow = ((base.getUTCDay() + 6) % 7) + 1;
    if (r.frecuencia === "semanal" && dow !== r.diaSemana) continue;
    if (r.frecuencia === "mensual" && d !== r.diaMes) continue;
    const t = instanteDe(y, m, d, hh, mm, r.timezone);
    if (t.getTime() > desde.getTime()) return t;
  }
  throw new Error("No se pudo calcular la próxima ejecución.");
}

export function describir(r: Recurrencia): string {
  const cuando =
    r.frecuencia === "diaria"
      ? "Todos los días"
      : r.frecuencia === "semanal"
        ? `Todos los ${DIAS[(r.diaSemana ?? 1) - 1]}`
        : `El día ${r.diaMes} de cada mes`;
  return `${cuando} a las ${r.hora}`;
}

// Destinos -----------------------------------------------------------------------

export const destinoSchema = z.discriminatedUnion("canal", [
  z.object({
    canal: z.literal("slack"),
    direccion: z
      .string()
      .trim()
      .regex(/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/, "El webhook de Slack tiene que empezar con https://hooks.slack.com/services/"),
  }),
  z.object({ canal: z.literal("email"), direccion: z.string().trim().email("Email inválido.") }),
]);
export type Destino = z.infer<typeof destinoSchema>;

/** Lo que se muestra: nunca el webhook completo (es una credencial). */
export function enmascarar(d: Destino): string {
  if (d.canal === "email") return d.direccion;
  const partes = d.direccion.split("/");
  return `hooks.slack.com/…/${(partes.at(-1) ?? "").slice(-4).padStart(8, "•")}`;
}

/** Markdown del reporte → mrkdwn de Slack (**x** → *x*, _x_ se mantiene). */
export function aMrkdwn(md: string): string {
  return md.replace(/\*\*([^*]+)\*\*/g, "*$1*").replace(/^#{1,3}\s+(.*)$/gm, "*$1*");
}
