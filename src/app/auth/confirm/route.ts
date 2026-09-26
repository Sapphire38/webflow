import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { destinoSeguro } from "@/lib/auth/redirect";
import { BASE_PATH } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";


/** Variante con token_hash (plantillas de email de Supabase con {{ .TokenHash }}). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = destinoSeguro(searchParams.get("next"), type === "recovery" ? "/reset-password" : "/chat");
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${BASE_PATH}${next}`);
  }
  return NextResponse.redirect(`${origin}${BASE_PATH}/login?error=link`);
}
