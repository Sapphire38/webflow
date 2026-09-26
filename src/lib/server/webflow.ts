/**
 * Webflow Data API v2 (solo fetch: corre en Edge). Se autentica con un token de sitio
 * con scopes `sites:read` y `cms:read`, que se guarda cifrado.
 */
import { MAX_FILAS } from "@/lib/data/csv";
import { inferirCampos } from "@/lib/data/engine";
import { FuenteRemotaError } from "@/lib/data/remote";
import { filasDeItems, type ItemWebflow } from "@/lib/data/webflow";
import type { Importado } from "./remote";

const API = "https://api.webflow.com/v2";

async function webflow<T>(token: string, ruta: string, fetcher: typeof fetch = fetch): Promise<T> {
  let r: Response;
  try {
    r = await fetcher(`${API}${ruta}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new FuenteRemotaError("Webflow no respondió.");
  }
  if (r.status === 401) throw new FuenteRemotaError("Webflow rechazó el token. Revisá que sea un token de sitio vigente.");
  if (r.status === 403) throw new FuenteRemotaError("Al token le faltan permisos: necesita sites:read y cms:read.");
  if (r.status === 429) throw new FuenteRemotaError("Webflow limitó los pedidos. Probá en un minuto.");
  if (!r.ok) throw new FuenteRemotaError(`Webflow respondió ${r.status}.`);
  return (await r.json()) as T;
}

export interface ColeccionWebflow {
  id: string;
  nombre: string;
  sitio: string;
}

export function validarToken(token: string): string {
  const t = token.trim();
  if (t.length < 20 || /\s/.test(t)) throw new FuenteRemotaError("Pegá el token de API del sitio (Site settings → Apps & integrations → API access).");
  return t;
}

export async function listarColecciones(token: string, fetcher: typeof fetch = fetch): Promise<ColeccionWebflow[]> {
  const { sites } = await webflow<{ sites: { id: string; displayName: string }[] }>(token, "/sites", fetcher);
  if (!sites?.length) throw new FuenteRemotaError("El token no tiene acceso a ningún sitio.");
  const porSitio = await Promise.all(
    sites.slice(0, 10).map(async (s) => {
      const { collections } = await webflow<{ collections: { id: string; displayName: string }[] }>(token, `/sites/${s.id}/collections`, fetcher);
      return (collections ?? []).map((c) => ({ id: c.id, nombre: c.displayName, sitio: s.displayName }));
    }),
  );
  return porSitio.flat();
}

/** Trae todos los items de la colección, paginando de a 100, hasta MAX_FILAS. */
export async function importarColeccion(token: string, collectionId: string, fetcher: typeof fetch = fetch): Promise<Importado> {
  if (!/^[a-f0-9]{24}$/i.test(collectionId)) throw new FuenteRemotaError("Id de colección inválido.");
  const items: ItemWebflow[] = [];
  let total = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset < total && items.length < MAX_FILAS; offset += 100) {
    const r = await webflow<{ items: ItemWebflow[]; pagination?: { total: number } }>(token, `/collections/${collectionId}/items?limit=100&offset=${offset}`, fetcher);
    items.push(...(r.items ?? []));
    total = r.pagination?.total ?? items.length;
    if (!r.items?.length) break;
  }
  const filas = filasDeItems(items).slice(0, MAX_FILAS);
  if (filas.length === 0) throw new FuenteRemotaError("La colección no tiene items.");
  return { filas, campos: inferirCampos(filas), truncado: items.length > MAX_FILAS };
}
