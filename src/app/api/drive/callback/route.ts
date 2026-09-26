import type { NextRequest } from "next/server";
import { FuenteRemotaError } from "@/lib/data/remote";
import { BASE_PATH, redirigir, urlPublica } from "@/lib/env";
import { canjearCodigo, urlRedirect, verificarState } from "@/lib/server/drive";
import { createClient } from "@/lib/supabase/server";


export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const volver = (q: string) => redirigir(`/datos?${q}`);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirigir("/login?next=/datos");
  if (searchParams.get("error")) return volver("drive=error&motivo=cancelado");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return volver("drive=error&motivo=incompleto");
  try {
    await verificarState(state, user.id);
    await canjearCodigo(supabase, user.id, code, urlRedirect(urlPublica(), BASE_PATH));
    return volver("drive=ok");
  } catch (e) {
    console.error("drive callback", e);
    const motivo = e instanceof FuenteRemotaError ? e.message : "No se pudo conectar Drive.";
    return volver(`drive=error&motivo=${encodeURIComponent(motivo)}`);
  }
}
