import { NextResponse } from "next/server";
import { BASE_PATH, redirigir, urlPublica } from "@/lib/env";
import { crearState, driveConfigurado, urlConsentimiento, urlRedirect } from "@/lib/server/drive";
import { createClient } from "@/lib/supabase/server";


export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirigir("/login?next=/datos");
  if (!driveConfigurado()) return redirigir("/datos?drive=error&motivo=no-configurado");
  return NextResponse.redirect(urlConsentimiento(urlRedirect(urlPublica(), BASE_PATH), await crearState(user.id)));
}
