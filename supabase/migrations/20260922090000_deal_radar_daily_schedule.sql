-- Deal Radar: run once a day at 22:00 UTC (8am AEST / 9am AEDT).
-- Replaces the twice-daily job proposed in 20260920120000 (which was never scheduled).
-- Uses the public publishable key already shipped in the frontend; no secret stored.
-- The function rate-limits itself (45 min), so manual "Check now" cannot double-spend.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname in ('deal-radar-twice-daily', 'deal-radar-daily');
select cron.schedule(
  'deal-radar-daily',
  '0 22 * * *',
  $$
  select net.http_post(
    url := 'https://msmpigerejpxepkylkxz.supabase.co/functions/v1/deal-radar',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ',
      'Authorization','Bearer sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ'
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
