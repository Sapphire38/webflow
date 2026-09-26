import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { BASE_PATH, urlPublica } from "@/lib/env";
import { correrVencidas } from "@/lib/server/envios";


function autorizado(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || secreto.length < 16) return false;
  const h = req.headers.get("authorization") ?? "";
  const dado = h.startsWith("Bearer ") ? h.slice(7) : "";
  // Comparación de largo constante.
  if (dado.length !== secreto.length) return false;
  let dif = 0;
  for (let i = 0; i < dado.length; i++) dif |= dado.charCodeAt(i) ^ secreto.charCodeAt(i);
  return dif === 0;
}

/** Lo llama pg_cron (Supabase) cada 5 minutos. Usa la service role porque no hay usuario. */
async function manejar(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const resultados = await correrVencidas(admin, `${urlPublica()}${BASE_PATH}`);
  return Response.json({ ejecutadas: resultados.length, resultados });
}

export const GET = manejar;
export const POST = manejar;
