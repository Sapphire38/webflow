-- Datasets alimentados por Google Sheets (link público), una API REST (JSON) o Google Drive (OAuth).
-- `config` es pública (url, path de filas, fileId); `secretos` guarda los headers de la API
-- cifrados con AES-GCM por la app (FUENTES_SECRET) y nunca se devuelve al navegador.

alter table public.datasets drop constraint if exists datasets_origen_check;
alter table public.datasets
  add constraint datasets_origen_check check (origen in ('csv', 'ejemplo', 'sheets', 'api', 'drive'));

alter table public.datasets add column if not exists config jsonb;
alter table public.datasets add column if not exists secretos text;
alter table public.datasets add column if not exists actualizado_at timestamptz not null default now();

-- Conexión con Google Drive: una por usuario, refresh token cifrado.
create table if not exists public.conexiones_google (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  email text,
  refresh_token_cifrado text not null,
  created_at timestamptz not null default now()
);
alter table public.conexiones_google enable row level security;
drop policy if exists "conexion propia" on public.conexiones_google;
create policy "conexion propia" on public.conexiones_google
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
