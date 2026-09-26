/**
 * Piezas puras de las fuentes remotas (Google Sheets por link y API REST).
 * Sin I/O: el fetch vive en lib/server/remote.ts.
 */
import type { Fila } from "./engine";

export class FuenteRemotaError extends Error {}

const ID_SHEET = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/;

/** Convierte cualquier link de una Google Sheet en su URL de exportación CSV, conservando la pestaña (gid). */
export function urlCsvDeSheets(link: string): string {
  let u: URL;
  try {
    u = new URL(link.trim());
  } catch {
    throw new FuenteRemotaError("Pegá el link completo de la hoja (https://docs.google.com/spreadsheets/…).");
  }
  const m = ID_SHEET.exec(u.pathname);
  if (u.hostname !== "docs.google.com" || !m) {
    throw new FuenteRemotaError("Ese link no es de Google Sheets.");
  }
  const gid = u.searchParams.get("gid") ?? /gid=(\d+)/.exec(u.hash)?.[1];
  const salida = new URL(`https://docs.google.com/spreadsheets/d/${m[1]}/export`);
  salida.searchParams.set("format", "csv");
  if (gid) salida.searchParams.set("gid", gid);
  return salida.toString();
}

const HOST_PRIVADO = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.internal$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /^\[?fe80:/i,
];

/** Solo URLs http(s) públicas: evita que la app se use para pegarle a redes internas (SSRF). */
export function validarUrlPublica(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new FuenteRemotaError("La URL no es válida.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new FuenteRemotaError("Solo se aceptan URLs http o https.");
  if (u.username || u.password) throw new FuenteRemotaError("No pongas credenciales en la URL: usá los headers.");
  if (HOST_PRIVADO.some((r) => r.test(u.hostname))) throw new FuenteRemotaError("Esa dirección es privada o local.");
  return u;
}

function leerRuta(obj: unknown, ruta: string): unknown {
  return ruta
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((acc, k) => (acc !== null && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

/** Primer array de objetos que aparezca recorriendo el JSON a lo ancho. */
function primerArray(obj: unknown): unknown[] | null {
  const cola: unknown[] = [obj];
  while (cola.length) {
    const x = cola.shift();
    if (Array.isArray(x)) {
      if (x.length === 0 || x.some((i) => i !== null && typeof i === "object")) return x;
    } else if (x !== null && typeof x === "object") {
      cola.push(...Object.values(x));
    }
  }
  return null;
}

/** Aplana un nivel de anidamiento (`{planta:{nombre}}` → `planta.nombre`) para que el motor pueda agrupar. */
function aplanar(item: unknown): Fila {
  if (item === null || typeof item !== "object" || Array.isArray(item)) return { valor: item as unknown };
  const fila: Fila = {};
  for (const [k, v] of Object.entries(item)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v)) {
        fila[`${k}.${k2}`] = v2 !== null && typeof v2 === "object" ? JSON.stringify(v2) : v2;
      }
    } else {
      fila[k] = Array.isArray(v) ? JSON.stringify(v) : v;
    }
  }
  return fila;
}

export function extraerFilas(json: unknown, pathFilas?: string): Fila[] {
  const arr = pathFilas?.trim() ? leerRuta(json, pathFilas.trim()) : primerArray(json);
  if (!Array.isArray(arr)) {
    throw new FuenteRemotaError(
      pathFilas ? `En "${pathFilas}" no hay una lista de filas.` : "La respuesta no tiene ninguna lista de filas. Indicá el path.",
    );
  }
  const filas = arr.map(aplanar).filter((f) => Object.keys(f).length > 0);
  if (filas.length === 0) throw new FuenteRemotaError("La lista de filas está vacía.");
  return filas;
}

const HEADERS_PROHIBIDOS = new Set(["host", "content-length", "cookie", "connection", "transfer-encoding"]);

export function sanearHeaders(pares: { nombre: string; valor: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { nombre, valor } of pares) {
    const n = nombre.trim();
    if (!n) continue;
    if (!/^[A-Za-z0-9-]+$/.test(n)) throw new FuenteRemotaError(`El header "${n}" tiene caracteres inválidos.`);
    if (HEADERS_PROHIBIDOS.has(n.toLowerCase())) throw new FuenteRemotaError(`El header "${n}" no se puede definir.`);
    if (/[\r\n]/.test(valor)) throw new FuenteRemotaError(`El valor de "${n}" tiene saltos de línea.`);
    out[n] = valor;
  }
  return out;
}
