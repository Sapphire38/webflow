/**
 * Proyecciones: extiende una serie de tiempo del motor hacia adelante.
 * Puro y determinístico, igual que el motor: el modelo pide la proyección, pero los
 * números del futuro salen de acá, con su rango y el error medido contra lo real.
 */
import { z } from "zod";
import {
  type Campo,
  type Consulta,
  ConsultaError,
  consultaSchema,
  type Fila,
  type Granularidad,
  inicioDePeriodo,
  type Par,
  periodo,
  serieTemporal,
  siguientePeriodo,
} from "./engine";

export const METODOS = ["lineal", "holt", "holt_winters"] as const;
export type Metodo = (typeof METODOS)[number];

export const MIN_PERIODOS = 6;
/** Con menos de esto la tendencia de Holt no se estabiliza: alcanza con una recta. */
const MIN_HOLT = 10;
/** Largo de la temporada por granularidad. Semanas (52) necesitarían dos años de datos: no se modela. */
const TEMPORADA: Partial<Record<Granularidad, number>> = { mes: 12, trimestre: 4, dia: 7 };
/** Períodos que se pueden esconder para medir el error sin quedarse sin las dos temporadas que pide Holt-Winters. */
const RESERVA_BACKTEST = 3;
/** z de una normal para un rango del 80%: más angosto que el 95% y más honesto de leer. */
const Z_80 = 1.2816;

export const escenarioSchema = z.object({
  nombre: z.string().trim().min(1).max(40).describe('Nombre corto, ej.: "Optimista", "Córdoba +20%"'),
  cambioPct: z.number().min(-90).max(300).describe("Cambio porcentual sobre lo proyectado: 10 = +10%, -5 = -5%"),
  segmento: consultaSchema.shape.filtros.describe(
    "Opcional: filtros del segmento al que se aplica el cambio (ej.: {planta: 'Córdoba'}). Solo con sumar o contar",
  ),
});
export type Escenario = z.infer<typeof escenarioSchema>;

export const metaSchema = z.object({
  valor: z.number().describe("El objetivo, en la unidad de la métrica"),
  tipo: z
    .enum(["periodo", "acumulado"])
    .default("periodo")
    .describe("periodo: que un período llegue al valor. acumulado: que la suma de los períodos proyectados llegue"),
  sentido: z.enum(["superar", "bajar"]).default("superar").describe("superar: llegar o pasar el valor. bajar: quedar en el valor o por debajo"),
});
export type Meta = z.infer<typeof metaSchema>;

export const proyeccionSchema = z.object({
  horizonte: z.number().int().min(1).max(24).describe("Cuántos períodos proyectar hacia adelante"),
  escenarios: z.array(escenarioSchema).max(3).optional().describe("Qué pasaría si: variantes de la proyección base"),
  meta: metaSchema.optional().describe("Objetivo a evaluar: cuándo se alcanza y con qué probabilidad"),
});
export type PedidoProyeccion = z.infer<typeof proyeccionSchema>;

export interface PuntoProyectado extends Par {
  bajo: number;
  alto: number;
}

export interface ResultadoEscenario {
  nombre: string;
  valores: Par[];
  /** Cuánto cambia el horizonte completo contra la proyección base, en %. */
  diferenciaPct: number;
}

export interface ResultadoMeta extends Meta {
  /** Primer período proyectado en el que se cumple, o null si no se cumple en el horizonte. */
  alcanzaEn: string | null;
  /** Probabilidad (0-100) de cumplirla en `alcanzaEn`, o al final del horizonte si no se alcanza. */
  probabilidad: number;
}

export interface Proyeccion {
  metodo: Metodo;
  proyectado: PuntoProyectado[];
  escenarios?: ResultadoEscenario[];
  meta?: ResultadoMeta;
  /** Error porcentual medio al proyectar los últimos períodos conocidos (backtest). */
  errorPct: number | null;
  periodosEvaluados: number;
  /** Período en curso: se proyecta en vez de mostrarse, porque todavía no cerró. */
  parcial?: string;
}

interface Ajuste {
  pronosticar(h: number): number[];
  /** Errores de un paso dentro de la muestra: miden cuánto se equivoca el modelo. */
  residuos: number[];
}

function lineal(y: number[]): Ajuste {
  const n = y.length;
  const mx = (n - 1) / 2;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let t = 0; t < n; t++) {
    num += (t - mx) * (y[t] - my);
    den += (t - mx) ** 2;
  }
  const b = den ? num / den : 0;
  const a = my - b * mx;
  return {
    pronosticar: (h) => Array.from({ length: h }, (_, i) => a + b * (n + i)),
    residuos: y.map((v, t) => v - (a + b * t)),
  };
}

const GRILLA = [0.1, 0.3, 0.5, 0.7, 0.9];
const sse = (r: number[]) => r.reduce((a, e) => a + e * e, 0);

function holt(y: number[]): Ajuste {
  let mejor: { sse: number; l: number; b: number; residuos: number[] } | null = null;
  for (const alfa of GRILLA) {
    for (const beta of GRILLA) {
      let l = y[0];
      let b = y[1] - y[0];
      const residuos: number[] = [];
      for (let t = 1; t < y.length; t++) {
        residuos.push(y[t] - (l + b));
        const nl = alfa * y[t] + (1 - alfa) * (l + b);
        b = beta * (nl - l) + (1 - beta) * b;
        l = nl;
      }
      const e = sse(residuos);
      if (!mejor || e < mejor.sse) mejor = { sse: e, l, b, residuos };
    }
  }
  const { l, b, residuos } = mejor!;
  return { pronosticar: (h) => Array.from({ length: h }, (_, i) => l + (i + 1) * b), residuos };
}

function holtWinters(y: number[], m: number): Ajuste {
  const media = (xs: number[]) => xs.reduce((a, v) => a + v, 0) / xs.length;
  const l0 = media(y.slice(0, m));
  const b0 = (media(y.slice(m, 2 * m)) - l0) / m;
  let mejor: { sse: number; l: number; b: number; s: number[]; residuos: number[] } | null = null;
  for (const alfa of GRILLA) {
    for (const beta of GRILLA) {
      for (const gamma of GRILLA) {
        let l = l0;
        let b = b0;
        const s = y.slice(0, m).map((v) => v - l0);
        const residuos: number[] = [];
        for (let t = m; t < y.length; t++) {
          residuos.push(y[t] - (l + b + s[t - m]));
          const nl = alfa * (y[t] - s[t - m]) + (1 - alfa) * (l + b);
          b = beta * (nl - l) + (1 - beta) * b;
          s[t] = gamma * (y[t] - nl) + (1 - gamma) * s[t - m];
          l = nl;
        }
        const e = sse(residuos);
        if (!mejor || e < mejor.sse) mejor = { sse: e, l, b, s, residuos };
      }
    }
  }
  const { l, b, s, residuos } = mejor!;
  const n = y.length;
  return {
    pronosticar: (h) => Array.from({ length: h }, (_, i) => l + (i + 1) * b + s[n - m + (i % m)]),
    residuos,
  };
}

function elegir(n: number, g: Granularidad): Metodo {
  const m = TEMPORADA[g];
  if (m && n >= 2 * m + RESERVA_BACKTEST) return "holt_winters";
  return n >= MIN_HOLT ? "holt" : "lineal";
}

function ajustar(y: number[], metodo: Metodo, g: Granularidad): Ajuste {
  if (metodo === "holt_winters") return holtWinters(y, TEMPORADA[g]!);
  return metodo === "holt" ? holt(y) : lineal(y);
}

/**
 * Backtest: se esconde el final de la serie, se proyecta con el mismo método y se
 * compara contra lo que pasó. Es la cifra que dice cuánto confiar en la proyección.
 */
function backtest(y: number[], metodo: Metodo, g: Granularidad, horizonte: number): { errorPct: number | null; periodos: number } {
  const minimo = metodo === "holt_winters" ? 2 * TEMPORADA[g]! : 3;
  const k = Math.min(horizonte, Math.max(1, Math.floor(y.length / 4)), y.length - minimo);
  if (k < 1) return { errorPct: null, periodos: 0 };
  const previsto = ajustar(y.slice(0, y.length - k), metodo, g).pronosticar(k);
  const errores = y
    .slice(-k)
    .map((real, i) => (real === 0 ? null : Math.abs(previsto[i] - real) / Math.abs(real)))
    .filter((e): e is number => e !== null);
  if (errores.length === 0) return { errorPct: null, periodos: 0 };
  return { errorPct: redondear((errores.reduce((a, e) => a + e, 0) / errores.length) * 100), periodos: k };
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Función de distribución de la normal estándar (aproximación de Abramowitz y Stegun, error < 1e-7). */
function normal(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/**
 * Evalúa una meta sobre la proyección, tratando cada período como una normal centrada
 * en lo proyectado con el desvío de la banda. En el acumulado las varianzas se suman
 * (supone errores independientes: si algo, la probabilidad queda optimista en los extremos).
 */
function evaluarMeta(meta: Meta, centros: number[], desvios: number[], etiquetas: string[]): ResultadoMeta {
  const cumple = (v: number) => (meta.sentido === "superar" ? v >= meta.valor : v <= meta.valor);
  const probabilidad = (centro: number, desvio: number) => {
    if (desvio === 0) return cumple(centro) ? 1 : 0;
    const p = normal((centro - meta.valor) / desvio);
    return meta.sentido === "superar" ? p : 1 - p;
  };
  let acumulado = 0;
  let varianza = 0;
  let ultima = 0;
  for (let i = 0; i < centros.length; i++) {
    const [centro, desvio] =
      meta.tipo === "acumulado"
        ? [(acumulado += centros[i]), Math.sqrt((varianza += desvios[i] ** 2))]
        : [centros[i], desvios[i]];
    ultima = probabilidad(centro, desvio);
    // Un tope acumulado siempre se cumple al principio: lo que importa es cómo termina el horizonte.
    const soloAlFinal = meta.tipo === "acumulado" && meta.sentido === "bajar" && i < centros.length - 1;
    if (!soloAlFinal && cumple(centro)) return { ...meta, alcanzaEn: etiquetas[i], probabilidad: Math.round(ultima * 100) };
  }
  return { ...meta, alcanzaEn: null, probabilidad: Math.round(ultima * 100) };
}

/** Proyecta valores ya agregados. `etiquetas` son las de los períodos futuros, en orden. */
export function pronosticar(y: number[], g: Granularidad, etiquetas: string[], meta?: Meta): Omit<Proyeccion, "parcial"> {
  if (y.length < MIN_PERIODOS)
    throw new ConsultaError(
      `Para proyectar hacen falta al menos ${MIN_PERIODOS} períodos cerrados y hay ${y.length}. Probá con una granularidad más fina.`,
      "POCOS_PERIODOS",
    );
  const metodo = elegir(y.length, g);
  const ajuste = ajustar(y, metodo, g);
  const sigma = Math.sqrt(sse(ajuste.residuos) / Math.max(1, ajuste.residuos.length));
  // Si la serie nunca fue negativa (ventas, horas, conteos), el futuro tampoco.
  const piso = y.every((v) => v >= 0) ? 0 : Number.NEGATIVE_INFINITY;
  const proyectado = ajuste.pronosticar(etiquetas.length).map((v, i) => {
    const margen = Z_80 * sigma * Math.sqrt(i + 1);
    return {
      etiqueta: etiquetas[i],
      valor: redondear(Math.max(piso, v)),
      bajo: redondear(Math.max(piso, v - margen)),
      alto: redondear(Math.max(piso, v + margen)),
    };
  });
  const { errorPct, periodos } = backtest(y, metodo, g, etiquetas.length);
  const resultado = { metodo, proyectado, errorPct, periodosEvaluados: periodos };
  if (!meta) return resultado;
  const desvios = proyectado.map((_, i) => sigma * Math.sqrt(i + 1));
  return { ...resultado, meta: evaluarMeta(meta, proyectado.map((p) => p.valor), desvios, etiquetas) };
}

const suma = (xs: number[]) => xs.reduce((a, v) => a + v, 0);

/**
 * Un escenario sin segmento escala toda la proyección. Con segmento se proyecta ese
 * segmento por separado y solo su parte cambia: "si Córdoba crece 20%" no mueve a Rosario.
 * Eso solo tiene sentido si la métrica se puede sumar por partes.
 */
function aplicarEscenario(
  e: Escenario,
  base: PuntoProyectado[],
  piso: number,
  segmentoProyectado: () => number[],
): ResultadoEscenario {
  const factor = e.cambioPct / 100;
  const delta = e.segmento ? segmentoProyectado().map((v) => v * factor) : base.map((p) => p.valor * factor);
  const valores = base.map((p, i) => ({ etiqueta: p.etiqueta, valor: redondear(Math.max(piso, p.valor + delta[i])) }));
  const totalBase = suma(base.map((p) => p.valor));
  const diferenciaPct = totalBase === 0 ? 0 : redondear(((suma(valores.map((v) => v.valor)) - totalBase) / Math.abs(totalBase)) * 100);
  return { nombre: e.nombre, valores, diferenciaPct };
}

/** Serie real + proyección, listas para graficar. El período en curso se proyecta, no se muestra. */
export function proyectar(filas: Fila[], campos: Campo[], consulta: Consulta, pedido: z.input<typeof proyeccionSchema>): { historico: Par[]; proyeccion: Proyeccion } {
  const { horizonte, escenarios, meta } = proyeccionSchema.parse(pedido);
  const serie = serieTemporal(filas, campos, consulta);
  const g = serie.granularidad;
  const cerrados = serie.parcial ? serie.puntos.slice(0, -1) : serie.puntos;
  if (cerrados.length === 0) throw new ConsultaError("No hay períodos cerrados para proyectar.", "POCOS_PERIODOS");

  const etiquetas: string[] = [];
  let d = siguientePeriodo(inicioDePeriodo(cerrados[cerrados.length - 1].clave, g), g);
  for (let i = 0; i < horizonte; i++, d = siguientePeriodo(d, g)) etiquetas.push(periodo(d, g)[1]);

  const base = pronosticar(
    cerrados.map((p) => p.valor),
    g,
    etiquetas,
    meta,
  );
  const aditiva = consulta.operacion === "sumar" || consulta.operacion === "contar";
  const piso = cerrados.every((p) => p.valor >= 0) ? 0 : Number.NEGATIVE_INFINITY;
  const resultados = escenarios?.map((e) => {
    if (e.segmento && !aditiva)
      throw new ConsultaError(
        `El escenario "${e.nombre}" cambia un segmento, y eso solo se puede con sumar o contar. Sacale el segmento o cambiá la operación.`,
        "ESCENARIO_NO_ADITIVO",
      );
    return aplicarEscenario(e, base.proyectado, piso, () => {
      // Se alinea con los mismos períodos de la base: donde el segmento no tuvo filas, aportó 0.
      const parte = serieTemporal(filas, campos, { ...consulta, filtros: { ...consulta.filtros, ...e.segmento } });
      const porClave = new Map(parte.puntos.map((p) => [p.clave, p.valor]));
      return pronosticar(
        cerrados.map((p) => porClave.get(p.clave) ?? 0),
        g,
        etiquetas,
      ).proyectado.map((p) => p.valor);
    });
  });
  return {
    historico: cerrados.map((p) => ({ etiqueta: p.etiqueta, valor: redondear(p.valor) })),
    proyeccion: { ...base, ...(resultados && { escenarios: resultados }), parcial: serie.parcial },
  };
}
