import type { SupabaseClient } from "@supabase/supabase-js";
import type { Campo, Fila } from "@/lib/data/engine";

export interface DatasetResumen {
  id: string;
  nombre: string;
  campos: Campo[];
  cantidad_filas: number;
  origen: "csv" | "ejemplo" | "sheets" | "api" | "drive" | "webflow";
  config: { tipo: string; link?: string; url?: string; fileId?: string; nombre?: string; headers?: string[]; coleccion?: string; sitio?: string } | null;
  created_at: string;
  actualizado_at: string;
}

export interface DatasetCompleto extends DatasetResumen {
  filas: Fila[];
}

export async function listarDatasets(supabase: SupabaseClient): Promise<DatasetResumen[]> {
  const { data, error } = await supabase
    .from("datasets")
    .select("id, nombre, campos, cantidad_filas, origen, config, created_at, actualizado_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as DatasetResumen[];
}

/** Carga las filas una sola vez por request: el chat y los widgets consultan el mismo dataset varias veces. */
export function cargadorDeDatasets(supabase: SupabaseClient, userId?: string) {
  const cache = new Map<string, Promise<DatasetCompleto | null>>();
  return (id: string) => {
    let p = cache.get(id);
    if (!p) {
      p = Promise.resolve(
        supabase
        .from("datasets")
        .select("id, nombre, campos, filas, cantidad_filas, origen, config, created_at, actualizado_at")
        .eq("id", id)
        // Con la service role (cron) no hay RLS: el filtro por dueño lo pone el código.
        .match(userId ? { user_id: userId } : {})
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) throw new Error(error.message);
          return data as DatasetCompleto | null;
        }),
      );
      cache.set(id, p);
    }
    return p;
  };
}
