"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec, Presentacion } from "@/lib/data/chart";
import { calcularKpi } from "@/lib/data/chart";
import { cn, formatoNumero } from "@/lib/utils";

const PALETA = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
const eje = { fontSize: 11, fill: "var(--ink-3)", fontFamily: "var(--font-geist-mono)" };

function Tip({ active, payload, unidad }: { active?: boolean; payload?: { payload: { etiqueta: string; valor: number } }[]; unidad?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-ink-2">{d.etiqueta}</p>
      <p className="num mt-0.5 text-sm font-semibold text-ink">
        {formatoNumero(d.valor)} {unidad}
      </p>
    </div>
  );
}

function compacto(n: number) {
  return new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

const METODO: Record<NonNullable<ChartSpec["proyeccion"]>["metodo"], string> = {
  lineal: "tendencia lineal",
  holt: "tendencia suavizada",
  holt_winters: "tendencia con estacionalidad",
};

const COLOR_ESCENARIO = ["var(--chart-2)", "var(--chart-3)", "var(--chart-5)"];

interface PuntoGrafico {
  etiqueta: string;
  real?: number;
  proyectado?: number;
  banda?: [number, number];
  /** Valor de cada escenario, en el mismo orden que `proyeccion.escenarios`. */
  [escenario: `esc${number}`]: number | undefined;
}

function TipProyeccion({
  active,
  payload,
  unidad,
  escenarios = [],
}: {
  active?: boolean;
  payload?: { payload: PuntoGrafico }[];
  unidad?: string;
  escenarios?: string[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const esReal = d.real !== undefined;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-ink-2">
        {d.etiqueta} · {esReal ? "real" : "proyectado"}
      </p>
      <p className="num mt-0.5 text-sm font-semibold text-ink">
        {formatoNumero((esReal ? d.real : d.proyectado) ?? 0)} {unidad}
      </p>
      {!esReal && d.banda && (
        <p className="num mt-0.5 text-ink-3">
          entre {formatoNumero(d.banda[0])} y {formatoNumero(d.banda[1])}
        </p>
      )}
      {!esReal &&
        escenarios.map((nombre, i) => (
          <p key={nombre} className="num mt-0.5 flex items-center gap-1.5 text-ink-2">
            <span className="size-2 rounded-sm" style={{ background: COLOR_ESCENARIO[i] }} />
            {nombre}: {formatoNumero(d[`esc${i}`] ?? 0)}
          </p>
        ))}
    </div>
  );
}

function TextoMeta({ meta, unidad }: { meta: NonNullable<NonNullable<ChartSpec["proyeccion"]>["meta"]>; unidad?: string }) {
  const objetivo = `${meta.tipo === "acumulado" ? (meta.sentido === "bajar" ? "Acumular como máximo" : "Acumular") : meta.sentido === "bajar" ? "Bajar a" : "Llegar a"} ${compacto(meta.valor)}${unidad ? ` ${unidad}` : ""}`;
  return (
    <p className="mt-3 text-sm text-ink-2">
      <span className="font-medium text-ink">{objetivo}:</span>{" "}
      {meta.alcanzaEn
        ? `se alcanza en ${meta.alcanzaEn} (probabilidad ${meta.probabilidad}%)`
        : `no se alcanza en el horizonte (probabilidad al final: ${meta.probabilidad}%)`}
    </p>
  );
}

/** Lo real en línea llena, lo proyectado punteado y el rango probable sombreado detrás. */
function GraficoProyeccion({ spec, alto }: { spec: ChartSpec; alto: number }) {
  const p = spec.proyeccion!;
  const escenarios = p.escenarios ?? [];
  const ultimo = spec.datos[spec.datos.length - 1];
  const puntos: PuntoGrafico[] = [
    ...spec.datos.map((d) => ({ etiqueta: d.etiqueta, real: d.valor })),
    ...p.proyectado.map((d, j) => ({
      etiqueta: d.etiqueta,
      proyectado: d.valor,
      banda: [d.bajo, d.alto] as [number, number],
      ...Object.fromEntries(escenarios.map((e, i) => [`esc${i}`, e.valores[j]?.valor])),
    })),
  ];
  // El último punto real también abre las líneas proyectadas, así no queda un salto entre las dos.
  if (ultimo)
    puntos[spec.datos.length - 1] = {
      ...puntos[spec.datos.length - 1],
      proyectado: ultimo.valor,
      banda: [ultimo.valor, ultimo.valor],
      ...Object.fromEntries(escenarios.map((_, i) => [`esc${i}`, ultimo.valor])),
    };
  return (
    <div>
      <div style={{ height: alto }} className="w-full">
        <ResponsiveContainer>
          <ComposedChart data={puntos} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
            <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={compacto} />
            <Tooltip content={<TipProyeccion unidad={spec.unidad} escenarios={escenarios.map((e) => e.nombre)} />} cursor={{ stroke: "var(--line)" }} />
            <Area type="monotone" dataKey="banda" stroke="none" fill="var(--chart-1)" fillOpacity={0.14} isAnimationActive={false} />
            <Line type="monotone" dataKey="real" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="proyectado" stroke="var(--chart-1)" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 5 }} />
            {p.meta?.tipo === "periodo" && (
              <ReferenceLine y={p.meta.valor} stroke="var(--ink-3)" strokeDasharray="4 3" label={{ value: "Meta", position: "insideTopLeft", fill: "var(--ink-3)", fontSize: 11 }} />
            )}
            {escenarios.map((e, i) => (
              <Line key={e.nombre} type="monotone" dataKey={`esc${i}`} stroke={COLOR_ESCENARIO[i]} strokeWidth={2} strokeDasharray="2 4" dot={false} activeDot={{ r: 4 }} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {escenarios.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: "var(--chart-1)" }} />
            Base
          </li>
          {escenarios.map((e, i) => (
            <li key={e.nombre} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t-2 border-dotted" style={{ borderColor: COLOR_ESCENARIO[i] }} />
              {e.nombre}
              <span className="num text-ink-3">
                {e.diferenciaPct > 0 ? "+" : ""}
                {formatoNumero(e.diferenciaPct)}%
              </span>
            </li>
          ))}
        </ul>
      )}
      {p.meta && <TextoMeta meta={p.meta} unidad={spec.unidad} />}
      <p className="mt-3 text-xs text-ink-3">
        Proyección por {METODO[p.metodo]} · banda: rango probable (80%)
        {p.errorPct !== null && ` · en los últimos ${p.periodosEvaluados} períodos le erró ±${formatoNumero(p.errorPct)}%`}
        {p.parcial && ` · ${p.parcial} todavía no cerró: se proyecta`}
      </p>
    </div>
  );
}

export function Grafico({ spec, alto = 260 }: { spec: ChartSpec; alto?: number }) {
  const datos = spec.datos;
  if (spec.proyeccion && datos.length > 0) return <GraficoProyeccion spec={spec} alto={alto} />;
  if (datos.length === 0) return <p className="py-10 text-center text-sm text-ink-3">Sin datos</p>;
  const tip = <Tooltip content={<Tip unidad={spec.unidad} />} cursor={{ fill: "var(--paper-2)" }} />;
  const grid = <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />;
  const rotar = datos.length > 6 && !spec.horizontal;

  if (spec.tipo === "torta") {
    const total = datos.reduce((a, d) => a + d.valor, 0);
    return (
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div style={{ height: alto }} className="w-full sm:w-1/2">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={datos} dataKey="valor" nameKey="etiqueta" innerRadius="58%" outerRadius="92%" paddingAngle={2} stroke="none">
                {datos.map((d, i) => (
                  <Cell key={d.etiqueta} fill={PALETA[i % PALETA.length]} />
                ))}
              </Pie>
              {tip}
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="w-full space-y-1.5 text-sm sm:w-1/2">
          {datos.map((d, i) => (
            <li key={d.etiqueta} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: PALETA[i % PALETA.length] }} />
              <span className="truncate text-ink-2">{d.etiqueta}</span>
              <span className="num ml-auto text-ink">{total ? Math.round((d.valor / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div style={{ height: alto }} className="w-full">
      <ResponsiveContainer>
        {spec.tipo === "linea" ? (
          <LineChart data={datos} margin={{ top: 8, right: 8, left: -8, bottom: rotar ? 24 : 0 }}>
            {grid}
            <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={false} angle={rotar ? -35 : 0} textAnchor={rotar ? "end" : "middle"} interval={0} />
            <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={compacto} />
            {tip}
            <Line type="monotone" dataKey="valor" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-1)" }} activeDot={{ r: 5 }} />
          </LineChart>
        ) : spec.tipo === "area" ? (
          <AreaChart data={datos} margin={{ top: 8, right: 8, left: -8, bottom: rotar ? 24 : 0 }}>
            <defs>
              <linearGradient id="relleno" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            {grid}
            <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={false} angle={rotar ? -35 : 0} textAnchor={rotar ? "end" : "middle"} interval={0} />
            <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={compacto} />
            {tip}
            <Area type="monotone" dataKey="valor" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#relleno)" />
          </AreaChart>
        ) : spec.horizontal ? (
          <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--line)" strokeDasharray="2 4" />
            <XAxis type="number" tick={eje} tickLine={false} axisLine={false} tickFormatter={compacto} />
            <YAxis type="category" dataKey="etiqueta" tick={eje} tickLine={false} axisLine={false} width={110} />
            {tip}
            <Bar dataKey="valor" radius={[0, 6, 6, 0]} fill="var(--chart-1)" />
          </BarChart>
        ) : (
          <BarChart data={datos} margin={{ top: 8, right: 8, left: -8, bottom: rotar ? 24 : 0 }}>
            {grid}
            <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={false} angle={rotar ? -35 : 0} textAnchor={rotar ? "end" : "middle"} interval={0} />
            <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={compacto} />
            {tip}
            <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
              {datos.map((d, i) => (
                <Cell key={d.etiqueta} fill={i === 0 && spec.receta.consulta.orden !== "etiqueta" ? "var(--chart-1)" : "color-mix(in srgb, var(--chart-1) 55%, var(--paper))"} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function Kpi({ spec, agregado }: { spec: ChartSpec; agregado?: Presentacion["agregado"] }) {
  const v = calcularKpi(spec.datos, agregado);
  return (
    <div className="py-4">
      <p className="num text-5xl font-semibold tracking-tight text-ink">
        {v === null ? "—" : compacto(v)}
        {spec.unidad && <span className="ml-2 text-lg text-ink-3">{spec.unidad}</span>}
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-ink-3">
        {agregado ?? "suma"} de {spec.datos.length} {spec.datos.length === 1 ? "valor" : "valores"}
      </p>
    </div>
  );
}

export function Tabla({ spec }: { spec: ChartSpec }) {
  const total = spec.datos.reduce((a, d) => a + d.valor, 0);
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-left text-xs uppercase tracking-[0.1em] text-ink-3">
          <tr>
            <th className="py-2 font-medium">Categoría</th>
            <th className="py-2 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {spec.datos.map((d) => (
            <tr key={d.etiqueta} className="border-t border-line">
              <td className="py-2 text-ink-2">{d.etiqueta}</td>
              <td className="num py-2 text-right">{formatoNumero(d.valor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink/20 font-semibold">
            <td className="py-2">Total</td>
            <td className="num py-2 text-right">{formatoNumero(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function VistaWidget({ spec, presentacion, className }: { spec: ChartSpec; presentacion?: Presentacion; className?: string }) {
  const tipo = presentacion?.tipo ?? "grafico";
  return (
    <div className={cn(className)}>
      {tipo === "kpi" ? <Kpi spec={spec} agregado={presentacion?.agregado} /> : tipo === "tabla" ? <Tabla spec={spec} /> : <Grafico spec={spec} />}
    </div>
  );
}
