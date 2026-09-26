import type { UIMessage } from "ai";

/** Título a partir del primer mensaje del usuario: espacios colapsados y corte en 60. */
export function tituloDesde(mensajes: UIMessage[]): string {
  const primero = mensajes.find((m) => m.role === "user");
  const texto = (primero?.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!texto) return "Nueva conversación";
  return texto.length > 60 ? `${texto.slice(0, 59).trimEnd()}…` : texto;
}

/** Repara conversaciones guardadas con ids vacíos o repetidos (versiones anteriores del guardado). */
export function conIds(mensajes: UIMessage[]): UIMessage[] {
  const vistos = new Set<string>();
  return mensajes.map((m, i) => {
    const id = m.id && !vistos.has(m.id) ? m.id : `m-${i}-${m.role}`;
    vistos.add(id);
    return id === m.id ? m : { ...m, id };
  });
}
