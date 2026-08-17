alter table public.scout_candidates
  add column if not exists saved boolean not null default false,
  add column if not exists saved_at timestamptz,
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null,
  add column if not exists last_deep_scanned_at timestamptz;

create index if not exists scout_candidates_user_saved_idx
  on public.scout_candidates(user_id, saved, saved_at desc)
  where saved = true;

create index if not exists scout_candidates_opportunity_idx
  on public.scout_candidates(opportunity_id)
  where opportunity_id is not null;
