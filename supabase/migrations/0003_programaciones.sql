-- Programación de reportes y registro de envíos.
-- Los destinos (webhooks de Slack, emails) van cifrados por la app en `destinos_cifrados`;
-- `destinos_publicos` guarda solo canal + dirección enmascarada para mostrar.

create table if not exists public.programaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dashboard_id uuid not null references public.dashboards (id) on delete cascade,
  frecuencia text not null check (frecuencia in ('diaria', 'semanal', 'mensual')),
  hora text not null check (hora ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  dia_semana int check (dia_semana between 1 and 7),
  dia_mes int check (dia_mes between 1 and 28),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  destinos_publicos jsonb not null default '[]'::jsonb,
  destinos_cifrados text not null,
  activa boolean not null default true,
  proxima_ejecucion timestamptz,
  ultima jsonb,
  created_at timestamptz not null default now()
);
create index if not exists programaciones_vencidas_idx on public.programaciones (activa, proxima_ejecucion);
create index if not exists programaciones_user_idx on public.programaciones (user_id, created_at desc);

create table if not exists public.envios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  programacion_id uuid references public.programaciones (id) on delete set null,
  reporte_id uuid references public.reportes (id) on delete set null,
  canal text not null check (canal in ('slack', 'email')),
  destinatario text not null,
  estado text not null check (estado in ('enviado', 'error')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists envios_user_idx on public.envios (user_id, created_at desc);

alter table public.programaciones enable row level security;
alter table public.envios enable row level security;

drop policy if exists "filas propias" on public.programaciones;
create policy "filas propias" on public.programaciones
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.dashboards d where d.id = dashboard_id and d.user_id = (select auth.uid()))
  );

drop policy if exists "filas propias" on public.envios;
create policy "filas propias" on public.envios
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
