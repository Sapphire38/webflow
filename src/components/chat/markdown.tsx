import { Fragment, type ReactNode } from "react";
import { sinCjk } from "@/lib/chat/limpiar";

/** Markdown mínimo y seguro (sin HTML crudo): párrafos, **negrita**, _itálica_, `código`, listas y títulos. */
function inline(texto: string, k: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
  return partes.map((p, i) => {
    const key = `${k}-${i}`;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={key} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={key} className="num rounded bg-paper-2 px-1 py-0.5 text-[0.85em]">{p.slice(1, -1)}</code>;
    if (p.startsWith("_") && p.endsWith("_") && p.length > 2) return <em key={key}>{p.slice(1, -1)}</em>;
    return <Fragment key={key}>{p}</Fragment>;
  });
}

const esFila = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const celdas = (l: string) =>
  l
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function Markdown({ texto }: { texto: string }) {
  const bloques: ReactNode[] = [];
  const lineas = sinCjk(texto).replace(/\r/g, "").split("\n");
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    // Tabla GFM: fila de cabecera + separador |---|---|.
    if (esFila(l) && i + 1 < lineas.length && /^\s*\|?\s*:?-{2,}/.test(lineas[i + 1])) {
      const cabecera = celdas(l);
      const filas: string[][] = [];
      i += 2;
      while (i < lineas.length && esFila(lineas[i])) {
        filas.push(celdas(lineas[i]));
        i++;
      }
      bloques.push(
        <div key={`t${i}`} className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-paper-2/60 text-left text-xs uppercase tracking-[0.08em] text-ink-3">
              <tr>
                {cabecera.map((c, j) => (
                  <th key={`h${j}`} className="px-3 py-2 font-medium">
                    {inline(c, `th${i}-${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, r) => (
                <tr key={`r${r}`} className="border-t border-line">
                  {cabecera.map((_, j) => (
                    <td key={`c${j}`} className={/^[\s$€%\d.,-]+$/.test(f[j] ?? "") ? "num px-3 py-2 text-right" : "px-3 py-2"}>
                      {inline(f[j] ?? "", `td${i}-${r}-${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l)) {
      const ordenada = /^\s*\d+[.)]\s+/.test(l);
      const items: string[] = [];
      while (i < lineas.length && (/^\s*[-*]\s+/.test(lineas[i]) || /^\s*\d+[.)]\s+/.test(lineas[i]))) {
        items.push(lineas[i].replace(/^\s*([-*]|\d+[.)])\s+/, ""));
        i++;
      }
      const Tag = ordenada ? "ol" : "ul";
      bloques.push(
        <Tag key={`l${i}`} className={ordenada ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5 marker:text-ember"}>
          {items.map((it, j) => (
            <li key={`${i}-${j}`}>{inline(it, `${i}-${j}`)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h) {
      bloques.push(<p key={`h${i}`} className="font-serif text-xl text-ink">{inline(h[2], `h${i}`)}</p>);
      i++;
      continue;
    }
    if (l.trim() === "") {
      i++;
      continue;
    }
    const parrafo: string[] = [];
    while (i < lineas.length && lineas[i].trim() !== "" && !/^\s*([-*]|\d+[.)])\s+/.test(lineas[i]) && !/^#{1,3}\s/.test(lineas[i]) && !esFila(lineas[i])) {
      parrafo.push(lineas[i]);
      i++;
    }
    bloques.push(<p key={`p${i}`}>{inline(parrafo.join(" "), `p${i}`)}</p>);
  }
  return <div className="space-y-3 leading-relaxed">{bloques}</div>;
}
