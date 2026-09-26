/**
 * Motor de agregación: la versión portada de `agregar_fuente`.
 * Es puro (sin I/O) para que el chat, los widgets y los reportes calculen
 * exactamente los mismos números sobre las mismas filas.
 */
import { z } from "zod";

export type Fila = Record<string, unknown>;
export type TipoCampo = "texto" | "numero" | "fecha" | "booleano" | "desconocido";
export interface Campo {
  nombre: string;
  tipo: TipoCampo;
}

export const OPERACIONES = ["contar", "sumar", "promedio", "min", "max"] as const;
export const GRANULARIDADES = ["dia", "semana", "mes", "trimestre", "anio"] as const;
export const ORDENES = ["valor_desc", "valor_asc", "etiqueta", "original"] as const;

const escalar = z.union([z.string(), z.number(), z.boolean()]);
const operadores = z
  .object({
    gt: escalar,
    gte: escalar,
    lt: escalar,
    lte: escalar,
    ne: escalar,
    in: z.array(escalar),
    contiene: z.string(),
    desde: z.string(),
    hasta: z.string(),
  })
  .partial();

export const consultaSchema = z.object({
  agruparPor: z.string().optional().describe("Campo por el que se agrupa (categoría o fecha)"),
  granularidad: z.enum(GRANULARIDADES).optional().describe("Solo si agruparPor es una fecha"),
  operacion: z.enum(OPERACIONES).default("contar"),
  campo: z.string().optional().describe("Campo numérico a agregar. No hace falta para contar"),
  filtros: z
    .record(z.string(), z.union([escalar, operadores]))
    .optional()
    .describe("Igualdad (valor) u operadores {gt,gte,lt,lte,ne,in,contiene,desde,hasta}"),
  top: z.number().int().min(2).max(100).optional(),
  orden: z.enum(ORDENES).optional(),
});
export type Consulta = z.infer<typeof consultaSchema>;

export interface Par {
  etiqueta: string;
  valor: number;
}

export class ConsultaError extends Error {
  constructor(
    message: string,
    readonly codigo: string,
  ) {
    super(message);
  }
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+Z?)?$/;
const FECHA_LATAM = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;

export function aFecha(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v !== "string") return null;
  const s = v.trim();
  const latam = FECHA_LATAM.exec(s);
  if (latam) {
    const anio = latam[3].length === 2 ? 2000 + Number(latam[3]) : Number(latam[3]);
    const d = new Date(Date.UTC(anio, Number(latam[2]) - 1, Number(latam[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (!FECHA_ISO.test(s)) return null;
  const d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function aNumero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
}

function tipoDe(v: unknown): TipoCampo {
  if (v === null || v === undefined || v === "") return "desconocido";
  if (typeof v === "boolean") return "booleano";
  if (aNumero(v) !== null) return "numero";
  if (aFecha(v)) return "fecha";
  return "texto";
}

/** Tipo de cada campo por voto mayoritario sobre una muestra, sin contar los vacíos. */
export function inferirCampos(filas: Fila[], muestra = 50): Campo[] {
  const nombres = new Set<string>();
  for (const f of filas.slice(0, muestra)) for (const k of Object.keys(f)) nombres.add(k);
  return [...nombres].map((nombre) => {
    const votos = new Map<TipoCampo, number>();
    for (const f of filas.slice(0, muestra)) {
      const t = tipoDe(f[nombre]);
      if (t !== "desconocido") votos.set(t, (votos.get(t) ?? 0) + 1);
    }
    const [tipo] = [...votos.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["desconocido"];
    return { nombre, tipo };
  });
}

function comparable(v: unknown): number | string | null {
  const n = aNumero(v);
  if (n !== null) return n;
  const d = aFecha(v);
  if (d) return d.getTime();
  return typeof v === "string" ? v.toLowerCase() : null;
}

function finDelDia(s: string): number | null {
  const d = aFecha(s);
  if (!d) return null;
  return s.trim().length <= 10 ? d.getTime() + 86_400_000 - 1 : d.getTime();
}

function cumple(valor: unknown, filtro: unknown): boolean {
  if (filtro === null || typeof filtro !== "object" || Array.isArray(filtro)) {
    return String(valor ?? "").toLowerCase() === String(filtro).toLowerCase();
  }
  const op = filtro as z.infer<typeof operadores>;
  const c = comparable(valor);
  if (op.ne !== undefined && String(valor ?? "").toLowerCase() === String(op.ne).toLowerCase()) return false;
  if (op.in && !op.in.some((x) => String(x).toLowerCase() === String(valor ?? "").toLowerCase())) return false;
  if (op.contiene !== undefined && !String(valor ?? "").toLowerCase().includes(op.contiene.toLowerCase())) return false;
  const cmp = (lim: unknown, f: (a: number | string, b: number | string) => boolean) => {
    const l = comparable(lim);
    return c !== null && l !== null && typeof c === typeof l && f(c, l);
  };
  if (op.gt !== undefined && !cmp(op.gt, (a, b) => a > b)) return false;
  if (op.gte !== undefined && !cmp(op.gte, (a, b) => a >= b)) return false;
  if (op.lt !== undefined && !cmp(op.lt, (a, b) => a < b)) return false;
  if (op.lte !== undefined && !cmp(op.lte, (a, b) => a <= b)) return false;
  if (op.desde !== undefined) {
    const d = aFecha(valor);
    const lim = aFecha(op.desde);
    if (!d || !lim || d.getTime() < lim.getTime()) return false;
  }
  if (op.hasta !== undefined) {
    const d = aFecha(valor);
    const lim = finDelDia(op.hasta);
    if (!d || lim === null || d.getTime() > lim) return false;
  }
  return true;
}

export function filtrar(filas: Fila[], filtros: Consulta["filtros"]): Fila[] {
  if (!filtros || Object.keys(filtros).length === 0) return filas;
  return filas.filter((f) => Object.entries(filtros).every(([k, v]) => cumple(campoDe(f, k), v)));
}

/** Busca el campo sin distinguir mayúsculas: el modelo no siempre respeta el casing. */
function campoDe(fila: Fila, nombre: string): unknown {
  if (nombre in fila) return fila[nombre];
  const clave = Object.keys(fila).find((k) => k.toLowerCase() === nombre.toLowerCase());
  return clave === undefined ? undefined : fila[clave];
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Devuelve [clave ordenable, etiqueta legible] del período. */
function periodo(d: Date, g: (typeof GRANULARIDADES)[number]): [string, string] {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const dd = d.getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (g) {
    case "anio":
      return [`${y}`, `${y}`];
    case "trimestre": {
      const t = Math.floor(m / 3) + 1;
      return [`${y}-T${t}`, `T${t} ${y}`];
    }
    case "mes":
      return [`${y}-${pad(m + 1)}`, `${MESES[m]}/${String(y).slice(2)}`];
    case "semana": {
      // Semana que empieza el lunes.
      const lunes = new Date(Date.UTC(y, m, dd - ((d.getUTCDay() + 6) % 7)));
      const k = lunes.toISOString().slice(0, 10);
      return [k, `sem ${pad(lunes.getUTCDate())}/${pad(lunes.getUTCMonth() + 1)}`];
    }
    default:
      return [
        `${y}-${pad(m + 1)}-${pad(dd)}`,
        `${pad(dd)}/${pad(m + 1)}/${String(y).slice(2)}`,
      ];
  }
}

function reducir(valores: number[], op: (typeof OPERACIONES)[number], filas: number): number {
  switch (op) {
    case "contar":
      return filas;
    case "sumar":
      return valores.reduce((a, b) => a + b, 0);
    case "promedio":
      return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : Number.NaN;
    case "min":
      return valores.length ? Math.min(...valores) : Number.NaN;
    case "max":
      return valores.length ? Math.max(...valores) : Number.NaN;
  }
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function agregar(filas: Fila[], campos: Campo[], entrada: Consulta): Par[] {
  const c = consultaSchema.parse(entrada);
  const buscar = (n: string) => campos.find((x) => x.nombre.toLowerCase() === n.toLowerCase());
  const validos = campos.map((x) => x.nombre).join(", ");

  if (c.operacion !== "contar") {
    if (!c.campo) throw new ConsultaError(`La operación ${c.operacion} necesita un campo.`, "CAMPO_AUSENTE");
    const campo = buscar(c.campo);
    if (!campo) throw new ConsultaError(`No existe el campo "${c.campo}". Válidos: ${validos}`, "CAMPO_INEXISTENTE");
    if (campo.tipo !== "numero")
      throw new ConsultaError(`El campo "${campo.nombre}" no es numérico.`, "CAMPO_NO_NUMERICO");
  }
  const grupo = c.agruparPor ? buscar(c.agruparPor) : undefined;
  if (c.agruparPor && !grupo)
    throw new ConsultaError(`No existe el campo "${c.agruparPor}". Válidos: ${validos}`, "CAMPO_INEXISTENTE");
  if (c.granularidad && grupo?.tipo !== "fecha")
    throw new ConsultaError("La granularidad solo aplica si se agrupa por una fecha.", "GRANULARIDAD_SOBRE_TEXTO");
  for (const k of Object.keys(c.filtros ?? {})) {
    if (!buscar(k)) throw new ConsultaError(`No existe el campo "${k}" para filtrar. Válidos: ${validos}`, "CAMPO_INEXISTENTE");
  }

  const filtradas = filtrar(filas, c.filtros);
  if (filtradas.length === 0) throw new ConsultaError("Ninguna fila cumple los filtros.", "SIN_FILAS");

  const valorDe = (f: Fila) => (c.campo ? aNumero(campoDe(f, c.campo)) : null);

  if (!grupo) {
    const vals = filtradas.map(valorDe).filter((n): n is number => n !== null);
    const etiqueta = c.operacion === "contar" ? "Cantidad" : `${c.operacion} de ${c.campo}`;
    return [{ etiqueta, valor: redondear(reducir(vals, c.operacion, filtradas.length)) }];
  }

  const cronologico = grupo.tipo === "fecha";
  const gran = c.granularidad ?? "mes";
  const grupos = new Map<string, { etiqueta: string; valores: number[]; filas: number }>();
  for (const f of filtradas) {
    const crudo = campoDe(f, grupo.nombre);
    let clave: string;
    let etiqueta: string;
    if (cronologico) {
      const d = aFecha(crudo);
      if (!d) continue;
      [clave, etiqueta] = periodo(d, gran);
    } else {
      etiqueta = crudo === null || crudo === undefined || crudo === "" ? "(sin dato)" : String(crudo);
      clave = etiqueta;
    }
    const g = grupos.get(clave) ?? { etiqueta, valores: [], filas: 0 };
    g.filas += 1;
    const v = valorDe(f);
    if (v !== null) g.valores.push(v);
    grupos.set(clave, g);
  }

  let pares = [...grupos.entries()].map(([clave, g]) => ({
    clave,
    etiqueta: g.etiqueta,
    valor: reducir(g.valores, c.operacion, g.filas),
  }));
  pares = pares.filter((p) => Number.isFinite(p.valor));

  const orden = c.orden ?? (cronologico ? "etiqueta" : "valor_desc");
  if (orden === "valor_desc") pares.sort((a, b) => b.valor - a.valor);
  else if (orden === "valor_asc") pares.sort((a, b) => a.valor - b.valor);
  else if (orden === "etiqueta") pares.sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0));

  const top = c.top ?? (cronologico ? 60 : 12);
  if (pares.length > top) {
    const resto = pares.slice(top - 1);
    const aditiva = c.operacion === "sumar" || c.operacion === "contar";
    pares = pares.slice(0, aditiva && !cronologico ? top - 1 : top);
    if (aditiva && !cronologico) {
      pares.push({ clave: "~", etiqueta: "Otras", valor: resto.reduce((a, p) => a + p.valor, 0) });
    }
  }
  return pares.map((p) => ({ etiqueta: p.etiqueta, valor: redondear(p.valor) }));
}
