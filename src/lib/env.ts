/** Mount path de Webflow Cloud. Link/redirect lo aplican solos; fetch e <img> manuales no. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const conBase = (ruta: string) => `${BASE_PATH}${ruta}`;

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example).");
  }
  return { url, anonKey };
}

/**
 * URL pública de la app. En Webflow Cloud el servidor ve un host interno
 * (*.cosmic.webflow.services), así que para links absolutos (emails, OAuth, reportes)
 * se usa NEXT_PUBLIC_SITE_URL, o el `origin` del navegador cuando lo hay.
 */
export function urlPublica(origenPedido?: string | null): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  if (origenPedido && !origenPedido.includes(".cosmic.webflow.services")) return origenPedido;
  return "https://webflow-eeebd5.webflow.io";
}

/** Redirect relativo: el navegador lo resuelve contra la URL pública, sea cual sea el host interno. */
export function redirigir(ruta: string, status = 307): Response {
  return new Response(null, { status, headers: { Location: `${BASE_PATH}${ruta}` } });
}
