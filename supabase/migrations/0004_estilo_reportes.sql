-- Estilo propio de los reportes: se define por dashboard y cada reporte guarda el que usó.
alter table public.dashboards add column if not exists estilo_reporte jsonb not null default '{}'::jsonb;
alter table public.reportes add column if not exists estilo jsonb not null default '{}'::jsonb;
