import { parsearCsv } from "@/lib/data/csv";
import { type Campo, type Fila, inferirCampos } from "@/lib/data/engine";
import { MAX_FILAS } from "@/lib/data/csv";
import { extraerFilas, FuenteRemotaError, urlCsvDeSheets, validarUrlPublica } from "@/lib/data/remote";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;

export interface ConfigSheets {
  tipo: "sheets";
  link: string;
}
export interface ConfigApi {
  tipo: "api";
  url: string;
  pathFilas?: string;
  /** Solo los nombres, para mostrarlos: los valores viven cifrados en `secretos`. */
  headers?: string[];
}
export interface ConfigDrive {
  tipo: "drive";
  fileId: string;
  nombre: string;
}
export interface ConfigWebflow {
  tipo: "webflow";
  collectionId: string;
  coleccion: string;
  sitio: string;
}
export type ConfigRemota = ConfigSheets | ConfigApi | ConfigDrive | ConfigWebflow;

export interface Importado {
  campos: Campo[];
  filas: Fila[];
  truncado: boolean;
}

async function traer(url: string, headers: Record<string, string>): Promise<Response> {
  let r: Response;
  try {
    r = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    const msg = (e as Error).name === "TimeoutError" ? "tardó más de 15 s" : "no respondió";
    throw new FuenteRemotaError(`La fuente ${msg}.`);
  }
  // Un redirect podría terminar en una red interna: se valida el destino final.
  validarUrlPublica(r.url || url);
  const largo = Number(r.headers.get("content-length") ?? 0);
  if (largo > MAX_BYTES) throw new FuenteRemotaError("La respuesta supera los 5 MB.");
  return r;
}

async function texto(r: Response): Promise<string> {
  const t = await r.text();
  if (t.length > MAX_BYTES) throw new FuenteRemotaError("La respuesta supera los 5 MB.");
  return t;
}

export async function importarSheets(link: string): Promise<Importado> {
  const r = await traer(urlCsvDeSheets(link), {});
  const tipo = r.headers.get("content-type") ?? "";
  if (r.status === 401 || r.status === 403 || r.status === 404 || tipo.includes("text/html")) {
    throw new FuenteRemotaError('No pude leer la hoja. Compartila como "Cualquier persona con el enlace puede ver".');
  }
  if (!r.ok) throw new FuenteRemotaError(`Google respondió ${r.status}.`);
  return parsearCsv(await texto(r));
}

export async function importarApi(cfg: { url: string; pathFilas?: string }, headers: Record<string, string>): Promise<Importado> {
  const url = validarUrlPublica(cfg.url).toString();
  const r = await traer(url, { Accept: "application/json", ...headers });
  if (r.status === 401 || r.status === 403) throw new FuenteRemotaError(`La API rechazó el acceso (${r.status}). Revisá los headers.`);
  if (!r.ok) throw new FuenteRemotaError(`La API respondió ${r.status}.`);
  let json: unknown;
  try {
    json = JSON.parse(await texto(r));
  } catch {
    throw new FuenteRemotaError("La respuesta no es JSON.");
  }
  const todas = extraerFilas(json, cfg.pathFilas);
  const filas = todas.slice(0, MAX_FILAS);
  return { campos: inferirCampos(filas), filas, truncado: todas.length > MAX_FILAS };
}
