-- Per-user daily usage limits (v0.156)
--
-- Every analysis, sale plan and eBay lookup costs real money on an API key Ben pays for.
-- Today one signed-in stranger could run thousands and the first anyone would know is the
-- bill. This is the counter that stops that, and the limits are set so an actual reseller
-- working hard never touches them - 25 analyses a day is far more than anyone flips.
--
-- Counting is atomic and per (user, day, kind), so a burst of parallel requests cannot slip
-- past the limit. Days are Melbourne days, because that is when the user's day resets.

create table if not exists public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null,
  used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day, kind)
);

alter table public.usage_counters enable row level security;

-- A user may see their own usage; nobody writes directly - only the function below does.
drop policy if exists usage_counters_own_read on public.usage_counters;
create policy usage_counters_own_read on public.usage_counters
  for select to authenticated using (user_id = auth.uid());

-- Claim one unit of quota. Returns whether it was allowed, without ever throwing, so a
-- caller can degrade politely rather than erroring out.
create or replace function public.claim_usage(p_kind text, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'Australia/Melbourne')::date;
  v_used integer;
begin
  if v_user is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_signed_in');
  end if;
  if p_limit is null or p_limit <= 0 then
    return jsonb_build_object('allowed', true, 'used', 0, 'limit', null);
  end if;

  insert into public.usage_counters (user_id, day, kind, used)
  values (v_user, v_day, p_kind, 1)
  on conflict (user_id, day, kind)
  do update set used = public.usage_counters.used + 1, updated_at = now()
  returning used into v_used;

  if v_used > p_limit then
    -- Over the line: give the unit back so the count reflects what was actually served.
    update public.usage_counters set used = p_limit
      where user_id = v_user and day = v_day and kind = p_kind;
    return jsonb_build_object(
      'allowed', false, 'reason', 'daily_limit', 'used', p_limit, 'limit', p_limit,
      'resets_at', ((v_day + 1)::timestamp at time zone 'Australia/Melbourne')
    );
  end if;

  return jsonb_build_object('allowed', true, 'used', v_used, 'limit', p_limit);
end;
$$;

-- What the signed-in user has used today, for showing them their own remaining quota.
create or replace function public.usage_today()
returns table (kind text, used integer)
language sql
security definer
set search_path = public
as $$
  select c.kind, c.used
  from public.usage_counters c
  where c.user_id = auth.uid()
    and c.day = (now() at time zone 'Australia/Melbourne')::date;
$$;

revoke all on function public.claim_usage(text, integer) from public, anon;
revoke all on function public.usage_today() from public, anon;
grant execute on function public.claim_usage(text, integer) to authenticated;
grant execute on function public.usage_today() to authenticated;
