import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { destinoSeguro } from "@/lib/auth/redirect";
import { redirigir } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";


/** Variante con token_hash (plantillas de email de Supabase con {{ .TokenHash }}). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = destinoSeguro(searchParams.get("next"), type === "recovery" ? "/reset-password" : "/chat");
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return redirigir(next);
  }
  return redirigir("/login?error=link");
}
