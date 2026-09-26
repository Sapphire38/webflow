import type { CSSProperties } from "react";
import { Grafico } from "@/components/chart/chart-view";
import { Markdown } from "@/components/chat/markdown";
import type { ChartSpec } from "@/lib/data/chart";
import { type Estilo, tintaSobre } from "@/lib/data/estilo";
import { cn } from "@/lib/utils";

/** El reporte con el estilo de la empresa: el acento pinta gráficos, bordes y la marca. */
export function ReporteVista({
  titulo,
  contenido,
  datos,
  estilo,
  subtitulo,
  compacto,
}: {
  titulo: string;
  contenido: string;
  datos: ChartSpec[];
  estilo: Estilo;
  subtitulo?: string;
  compacto?: boolean;
}) {
  const vars = { "--chart-1": estilo.acento, "--ember": estilo.acento, "--ember-ink": tintaSobre(estilo.acento) } as CSSProperties;
  const titulos = estilo.tipografia === "serif" ? "font-serif font-normal" : "font-sans font-semibold tracking-tight";
  return (
    <div style={vars}>
      <p className="num text-[11px] uppercase tracking-[0.2em]" style={{ color: estilo.acento }}>
        Reporte
      </p>
      <h1 className={cn("mt-3 leading-[1.05]", titulos, compacto ? "text-3xl" : "text-5xl")}>{titulo}</h1>
      {subtitulo && <p className="num mt-3 text-xs text-ink-3">{subtitulo}</p>}
      <section className={cn("border-l-2 pl-6 text-ink-2", compacto ? "mt-6 text-[15px]" : "mt-10 text-[17px]")} style={{ borderColor: estilo.acento }}>
        <Markdown texto={contenido} />
      </section>
      <section className={cn("space-y-10", compacto ? "mt-8" : "mt-12")}>
        {datos.map((s, i) => (
          <figure key={`${s.titulo}-${i}`} className="break-inside-avoid">
            <figcaption className={cn("mb-3", titulos, compacto ? "text-xl" : "text-2xl")}>{s.titulo}</figcaption>
            <Grafico spec={s} alto={compacto ? 200 : 260} />
          </figure>
        ))}
      </section>
      {estilo.pie && <footer className="mt-12 border-t border-line pt-4 text-xs text-ink-3">{estilo.pie}</footer>}
    </div>
  );
}
