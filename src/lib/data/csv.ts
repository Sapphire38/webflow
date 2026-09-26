import Papa from "papaparse";
import { type Campo, type Fila, inferirCampos } from "./engine";

export const MAX_FILAS = 5000;
export const MAX_BYTES = 2 * 1024 * 1024;

export interface DatasetParseado {
  campos: Campo[];
  filas: Fila[];
  truncado: boolean;
}

/** Parsea un CSV con cabecera. Los números quedan como número; lo demás, como texto. */
export function parsearCsv(texto: string): DatasetParseado {
  const r = Papa.parse<Fila>(texto.trim(), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (h) => h.trim(),
  });
  if (r.errors.length && r.data.length === 0) {
    throw new Error(`CSV inválido: ${r.errors[0].message}`);
  }
  const filas = r.data
    .map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== "")))
    .filter((f) => Object.values(f).some((v) => v !== null && v !== ""));
  if (filas.length === 0) throw new Error("El CSV no tiene filas.");
  const truncado = filas.length > MAX_FILAS;
  const recortadas = filas.slice(0, MAX_FILAS);
  return { campos: inferirCampos(recortadas), filas: recortadas, truncado };
}
