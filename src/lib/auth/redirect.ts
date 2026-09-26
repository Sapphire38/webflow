/**
 * Solo se aceptan destinos internos: evita que `?next=https://evil.com` convierta
 * el login en un open redirect.
 */
export function destinoSeguro(next: string | null | undefined, porDefecto = "/chat"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return porDefecto;
  return next;
}

/** URL absoluta para los links de email de Supabase, respetando el mount path. */
export function urlDeCallback(origin: string, basePath: string, next = "/chat"): string {
  const u = new URL(`${basePath}/auth/callback`, origin);
  u.searchParams.set("next", destinoSeguro(next));
  return u.toString();
}
