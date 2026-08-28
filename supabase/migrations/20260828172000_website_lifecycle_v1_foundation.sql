alter table public.opportunities
  add column if not exists is_shortlisted boolean not null default false,
  add column if not exists shortlisted_at timestamptz,
  add column if not exists is_saved boolean not null default false,
  add column if not exists saved_at timestamptz,
  add column if not exists dismissed_at timestamptz;

create index if not exists opportunities_user_saved_idx
  on public.opportunities(user_id, is_saved, updated_at desc);
create index if not exists opportunities_user_shortlisted_idx
  on public.opportunities(user_id, is_shortlisted, updated_at desc);
create unique index if not exists opportunities_user_source_url_unique
  on public.opportunities(user_id, source_url)
  where source_url is not null and source_url <> '';

create or replace function public.promote_scout_candidate_to_opportunity(p_candidate_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.scout_candidates%rowtype;
  opp_id uuid;
  platform text;
begin
  select * into c from public.scout_candidates where id = p_candidate_id;
  if not found then raise exception 'Scout candidate not found'; end if;
  if auth.uid() is not null and c.user_id <> auth.uid() then raise exception 'Not authorised'; end if;

  if c.opportunity_id is not null then
    update public.opportunities
      set is_saved = coalesce(c.saved,false) or is_saved,
          saved_at = case when coalesce(c.saved,false) then coalesce(saved_at,c.saved_at,now()) else saved_at end,
          is_shortlisted = coalesce(c.selected,false) or is_shortlisted,
          shortlisted_at = case when coalesce(c.selected,false) then coalesce(shortlisted_at,now()) else shortlisted_at end,
          updated_at = now()
    where id = c.opportunity_id;
    return c.opportunity_id;
  end if;

  platform := case
    when c.source_url ilike '%depop.%' then 'depop'
    when c.source_url ilike '%facebook.%' then 'facebook_marketplace'
    when c.source_url ilike '%ebay.%' then 'ebay'
    when c.source_url ilike '%gumtree.%' then 'gumtree'
    else 'other'
  end;

  select id into opp_id
  from public.opportunities
  where user_id = c.user_id and c.source_url is not null and source_url = c.source_url
  order by updated_at desc limit 1;

  if opp_id is null then
    insert into public.opportunities(
      user_id, source_platform, source_url, source_listing_id,
      listing_title, listing_text, seller_asking_price, currency,
      listing_location, seller_name, raw_listing, status,
      is_shortlisted, shortlisted_at, is_saved, saved_at
    ) values (
      c.user_id, platform, c.source_url, c.listing_id,
      c.title, coalesce(c.deep_capture->>'description', c.raw_capture->>'description'), c.asking_price, coalesce(c.currency,'AUD'),
      c.location, c.seller_name,
      jsonb_build_object(
        'scout_candidate_id', c.id,
        'thumbnail_url', c.thumbnail_url,
        'condition', c.condition,
        'raw_capture', c.raw_capture,
        'deep_capture', c.deep_capture,
        'scout_analysis', c.analysis,
        'scout_recommendation', c.recommendation,
        'scout_score', c.score
      ),
      case when c.scan_status in ('analysed','rated') then 'ready' else 'watching' end,
      coalesce(c.selected,false), case when coalesce(c.selected,false) then now() end,
      coalesce(c.saved,false), case when coalesce(c.saved,false) then coalesce(c.saved_at,now()) end
    ) returning id into opp_id;
  else
    update public.opportunities
      set is_saved = coalesce(c.saved,false) or is_saved,
          saved_at = case when coalesce(c.saved,false) then coalesce(saved_at,c.saved_at,now()) else saved_at end,
          is_shortlisted = coalesce(c.selected,false) or is_shortlisted,
          shortlisted_at = case when coalesce(c.selected,false) then coalesce(shortlisted_at,now()) else shortlisted_at end,
          updated_at = now()
    where id = opp_id;
  end if;

  update public.scout_candidates set opportunity_id = opp_id, updated_at = now() where id = c.id;
  return opp_id;
end;
$$;

revoke all on function public.promote_scout_candidate_to_opportunity(uuid) from public;
grant execute on function public.promote_scout_candidate_to_opportunity(uuid) to authenticated;

create or replace function public.sync_scout_candidate_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.saved,false) or coalesce(new.selected,false) then
    perform public.promote_scout_candidate_to_opportunity(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists scout_candidate_promote_engaged on public.scout_candidates;
create trigger scout_candidate_promote_engaged
after insert or update of saved, selected on public.scout_candidates
for each row
when (coalesce(new.saved,false) or coalesce(new.selected,false))
execute function public.sync_scout_candidate_promotion();
