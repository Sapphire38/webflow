import type { NextRequest } from "next/server";
import { destinoSeguro } from "@/lib/auth/redirect";
import { redirigir } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";


/** Canje PKCE de los links de email (confirmación, magic link, recuperación). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = destinoSeguro(searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirigir(next);
  }
  return redirigir("/login?error=link");
}
