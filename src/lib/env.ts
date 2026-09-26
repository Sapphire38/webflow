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
