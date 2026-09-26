import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(aSetear) {
        try {
          for (const { name, value, options } of aSetear) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies. No hay proxy
          // (Webflow Cloud corre en el edge), así que el refresco lo hacen el cliente
          // del navegador, las Server Actions y los route handlers.
        }
      },
    },
  });
}

/** Usuario verificado contra Supabase Auth (getUser valida el JWT, getSession no). */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
