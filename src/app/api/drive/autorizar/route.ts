import { type NextRequest, NextResponse } from "next/server";
import { BASE_PATH } from "@/lib/env";
import { crearState, driveConfigurado, urlConsentimiento, urlRedirect } from "@/lib/server/drive";
import { createClient } from "@/lib/supabase/server";


export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}${BASE_PATH}/login?next=/datos`);
  if (!driveConfigurado()) return NextResponse.redirect(`${origin}${BASE_PATH}/datos?drive=error&motivo=no-configurado`);
  return NextResponse.redirect(urlConsentimiento(urlRedirect(origin, BASE_PATH), await crearState(user.id)));
}
