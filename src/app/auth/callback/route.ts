import { type NextRequest, NextResponse } from "next/server";
import { destinoSeguro } from "@/lib/auth/redirect";
import { BASE_PATH } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

/** Canje PKCE de los links de email (confirmación, magic link, recuperación). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = destinoSeguro(searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${BASE_PATH}${next}`);
  }
  return NextResponse.redirect(`${origin}${BASE_PATH}/login?error=link`);
}
