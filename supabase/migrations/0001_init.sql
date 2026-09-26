-- Insight: esquema inicial.
-- Cada fila pertenece a un usuario de Supabase Auth y RLS garantiza que solo él la ve.
-- Aplicar en el SQL editor de Supabase o con `supabase db push`.


-- Perfiles ----------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Datasets (CSV subidos o de ejemplo) -------------------------------------
create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80),
  campos jsonb not null,
  filas jsonb not null,
  cantidad_filas int not null default 0,
  origen text not null default 'csv' check (origen in ('csv', 'ejemplo')),
  created_at timestamptz not null default now()
);
create index if not exists datasets_user_idx on public.datasets (user_id, created_at desc);

-- Conversaciones (mensajes UI del AI SDK en jsonb) ------------------------
create table if not exists public.conversaciones (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null default 'Nueva conversación',
  mensajes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversaciones_user_idx on public.conversaciones (user_id, updated_at desc);

-- Dashboards y widgets ----------------------------------------------------
create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dashboards_user_idx on public.dashboards (user_id, updated_at desc);

create table if not exists public.widgets (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 120),
  -- ChartSpec sin datos: tipo, unidad y la receta {datasetId, consulta}.
  spec jsonb not null,
  presentacion jsonb not null default '{"tipo":"grafico","ancho":1}'::jsonb,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists widgets_dashboard_idx on public.widgets (dashboard_id, orden);

-- Reportes: resumen narrado por IA sobre un dashboard ---------------------
create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dashboard_id uuid references public.dashboards (id) on delete set null,
  titulo text not null,
  contenido text not null,
  datos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists reportes_user_idx on public.reportes (user_id, created_at desc);

-- RLS ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.datasets enable row level security;
alter table public.conversaciones enable row level security;
alter table public.dashboards enable row level security;
alter table public.widgets enable row level security;
alter table public.reportes enable row level security;

drop policy if exists "perfil propio" on public.profiles;
create policy "perfil propio" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare t text;
begin
  foreach t in array array['datasets', 'conversaciones', 'dashboards', 'reportes'] loop
    execute format('drop policy if exists "filas propias" on public.%I', t);
    execute format(
      'create policy "filas propias" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Un widget solo puede colgar de un dashboard propio.
drop policy if exists "widgets propios" on public.widgets;
create policy "widgets propios" on public.widgets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.dashboards d where d.id = dashboard_id and d.user_id = (select auth.uid()))
  );
