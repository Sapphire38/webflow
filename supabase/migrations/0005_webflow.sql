-- Fuente Webflow CMS: una colección del CMS como dataset (token cifrado en `secretos`).
alter table public.datasets drop constraint if exists datasets_origen_check;
alter table public.datasets
  add constraint datasets_origen_check check (origen in ('csv', 'ejemplo', 'sheets', 'api', 'drive', 'webflow'));
