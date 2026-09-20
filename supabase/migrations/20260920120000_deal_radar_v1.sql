-- Deal Radar v1: shared, server-written list of retail deals evaluated for resale.
-- Users can read qualified deals only. Only the deal-radar Edge Function
-- (service role) writes. Each source deal is evaluated once (unique source_url).

create table if not exists public.radar_deals (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'ozbargain',
  source_url text not null unique,
  store_url text,
  store text,
  title text not null,
  category text,
  posted_at timestamptz,
  expires_at timestamptz,
  votes_pos integer,
  votes_neg integer,
  image_url text,
  product_name text,
  buy_price numeric,
  buy_shipping numeric,
  currency text not null default 'AUD',
  resale_low numeric,
  resale_mid numeric,
  resale_high numeric,
  resale_basis text check (resale_basis is null or resale_basis in ('sold','active','estimate','none')),
  selling_costs numeric,
  expected_profit numeric,
  roi_percent numeric,
  max_buy numeric,
  sell_time_days integer,
  demand text,
  confidence integer,
  evidence jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  summary text,
  status text not null default 'pending' check (status in ('pending','qualified','rejected','error')),
  reject_reason text,
  engine_version text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists radar_deals_status_checked_idx on public.radar_deals (status, checked_at desc);

alter table public.radar_deals enable row level security;
drop policy if exists radar_deals_read_qualified on public.radar_deals;
create policy radar_deals_read_qualified on public.radar_deals
  for select to authenticated using (status = 'qualified');

create table if not exists public.radar_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text,
  status text not null default 'running' check (status in ('running','finished','error')),
  engine_version text,
  stats jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists radar_runs_started_idx on public.radar_runs (started_at desc);

alter table public.radar_runs enable row level security;
drop policy if exists radar_runs_read on public.radar_runs;
create policy radar_runs_read on public.radar_runs
  for select to authenticated using (true);

-- Writes are service-role only: no insert/update/delete policies are created.
revoke insert, update, delete on public.radar_deals from anon, authenticated;
revoke insert, update, delete on public.radar_runs from anon, authenticated;
revoke all on public.radar_deals from anon;
revoke all on public.radar_runs from anon;

-- Schedule: 08:00 and 18:00 Melbourne (AEST, UTC+10) = 22:00 and 08:00 UTC.
-- The function rate-limits itself, so a manual "Check now" cannot double-spend.
-- Uses the public publishable key (already shipped in the frontend); no secret stored.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'deal-radar-twice-daily';
select cron.schedule(
  'deal-radar-twice-daily',
  '0 8,22 * * *',
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
