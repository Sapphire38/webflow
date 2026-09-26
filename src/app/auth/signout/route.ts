import { type NextRequest, NextResponse } from "next/server";
import { BASE_PATH } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";


export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${request.nextUrl.origin}${BASE_PATH}/login`, { status: 303 });
}
