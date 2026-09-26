/**
 * Items del CMS de Webflow (Data API v2) → filas planas para el motor.
 * `fieldData` trae texto, números, fechas, rich text (HTML), imágenes ({url}),
 * opciones y referencias; lo llevamos a valores escalares legibles.
 */
import type { Fila } from "./engine";

export interface ItemWebflow {
  id: string;
  createdOn?: string;
  lastPublished?: string | null;
  lastUpdated?: string;
  isDraft?: boolean;
  isArchived?: boolean;
  fieldData?: Record<string, unknown>;
}

function textoPlano(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function escalar(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return /<\/?[a-z][\s\S]*>/i.test(v) ? textoPlano(v).slice(0, 500) : v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x && "url" in x ? (x as { url: string }).url : String(x))).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.url === "string") return o.url;
    if (typeof o.name === "string") return o.name;
    return JSON.stringify(o);
  }
  return String(v);
}

/** Fecha ISO de Webflow → YYYY-MM-DD, que el motor reconoce y agrupa por período. */
const dia = (s?: string | null) => (s ? s.slice(0, 10) : null);

export function filasDeItems(items: ItemWebflow[]): Fila[] {
  return items
    .filter((i) => !i.isArchived)
    .map((i) => {
      const fila: Fila = {};
      for (const [k, v] of Object.entries(i.fieldData ?? {})) fila[k] = escalar(v);
      fila.estado = i.isDraft ? "borrador" : i.lastPublished ? "publicado" : "sin publicar";
      fila.creado = dia(i.createdOn);
      fila.publicado = dia(i.lastPublished);
      fila.actualizado = dia(i.lastUpdated);
      return fila;
    });
}
