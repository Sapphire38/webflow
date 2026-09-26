import { type NextRequest, NextResponse } from "next/server";
import { FuenteRemotaError } from "@/lib/data/remote";
import { BASE_PATH } from "@/lib/env";
import { canjearCodigo, urlRedirect, verificarState } from "@/lib/server/drive";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const volver = (q: string) => NextResponse.redirect(`${origin}${BASE_PATH}/datos?${q}`);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}${BASE_PATH}/login?next=/datos`);
  if (searchParams.get("error")) return volver("drive=error&motivo=cancelado");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return volver("drive=error&motivo=incompleto");
  try {
    await verificarState(state, user.id);
    await canjearCodigo(supabase, user.id, code, urlRedirect(origin, BASE_PATH));
    return volver("drive=ok");
  } catch (e) {
    console.error("drive callback", e);
    const motivo = e instanceof FuenteRemotaError ? e.message : "No se pudo conectar Drive.";
    return volver(`drive=error&motivo=${encodeURIComponent(motivo)}`);
  }
}
