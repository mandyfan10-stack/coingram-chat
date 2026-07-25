create extension if not exists pg_cron;

do $function$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'cleanup-orphaned-media-daily';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$function$;

select cron.schedule(
  'cleanup-orphaned-media-daily',
  '17 1 * * *',
  $job$
    select net.http_post(
      url := 'https://nluyrpickspjudxlokqv.supabase.co/functions/v1/cleanup-orphaned-media',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'coingram_anon_key' order by created_at desc limit 1),
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'coingram_anon_key' order by created_at desc limit 1),
        'x-cleanup-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'coingram_media_cleanup_secret' order by created_at desc limit 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);