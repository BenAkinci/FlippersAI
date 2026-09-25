-- Deal personalisation (v0.154)
--
-- Problem this solves: every user saw the same Deal Radar finds in the same order.
-- With more than a handful of users the good deals are gone before most people open
-- the app, and FlippersAI ends up telling many people about a flip only one of them
-- can have. This records each user's relationship to a find so the feed can be
-- ranked for the person looking at it, and so a deal others are already chasing is
-- labelled honestly instead of being presented as untouched.
--
-- Privacy: a user only ever reads their own rows. Interest is exposed to other users
-- as counts, through a security-definer function, never as identities.

create table if not exists public.radar_deal_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  radar_deal_id uuid not null references public.radar_deals(id) on delete cascade,
  status text not null check (status in ('interested', 'passed', 'bought')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, radar_deal_id)
);

create index if not exists radar_deal_claims_deal_idx on public.radar_deal_claims (radar_deal_id);
create index if not exists radar_deal_claims_user_idx on public.radar_deal_claims (user_id, updated_at desc);

alter table public.radar_deal_claims enable row level security;

drop policy if exists "radar_deal_claims own" on public.radar_deal_claims;
create policy "radar_deal_claims own" on public.radar_deal_claims
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Set (or clear) how the signed-in user stands on a find.
create or replace function public.set_radar_claim(p_deal uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if p_status is null then
    delete from public.radar_deal_claims where user_id = auth.uid() and radar_deal_id = p_deal;
    return;
  end if;

  if p_status not in ('interested', 'passed', 'bought') then
    raise exception 'Unknown status %', p_status;
  end if;

  insert into public.radar_deal_claims (user_id, radar_deal_id, status)
  values (auth.uid(), p_deal, p_status)
  on conflict (user_id, radar_deal_id)
  do update set status = excluded.status, updated_at = now();
end;
$$;

-- How many other people are already on each find. Counts only; never identities.
create or replace function public.radar_deal_interest(p_since timestamptz default now() - interval '7 days')
returns table (radar_deal_id uuid, others_interested integer, others_bought integer)
language sql
security definer
set search_path = public
as $$
  select c.radar_deal_id,
         count(*) filter (where c.status = 'interested' and c.user_id <> auth.uid())::integer,
         count(*) filter (where c.status = 'bought' and c.user_id <> auth.uid())::integer
  from public.radar_deal_claims c
  where c.created_at >= p_since
  group by c.radar_deal_id;
$$;

revoke all on function public.set_radar_claim(uuid, text) from public, anon;
revoke all on function public.radar_deal_interest(timestamptz) from public, anon;
grant execute on function public.set_radar_claim(uuid, text) to authenticated;
grant execute on function public.radar_deal_interest(timestamptz) to authenticated;

-- Which retail categories this user wants to see. Null/empty = everything.
alter table public.profiles add column if not exists deal_categories text[];
