-- Disparador de reportes programados: pg_cron llama al endpoint de la app cada 5 minutos.
-- Correr UNA vez en el SQL Editor de Supabase después del deploy, reemplazando:
--   <URL_DE_LA_APP>  → la URL pública de Webflow Cloud (con el mount path si lo hay)
--   <CRON_SECRET>    → el mismo valor que la variable CRON_SECRET del deploy
-- No commitear este archivo con valores reales.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('insight-reportes') where exists (select 1 from cron.job where jobname = 'insight-reportes');

select cron.schedule(
  'insight-reportes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := '<URL_DE_LA_APP>/api/cron/reportes',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>', 'Content-Type', 'application/json'),
    timeout_milliseconds := 60000
  );
  $$
);

-- Ver corridas:   select * from cron.job_run_details order by start_time desc limit 10;
-- Ver respuestas: select id, status_code, content from net._http_response order by created desc limit 10;
