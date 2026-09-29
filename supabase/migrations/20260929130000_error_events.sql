-- Error monitoring (v0.156)
--
-- Today a broken FlippersAI is only discovered when someone happens to mention it. This is
-- the smallest honest fix: the app records its own failures so they can be read back.
--
-- Deliberately narrow on what is stored. A crash report needs the message, where in the app
-- it happened and a trimmed stack - it does not need listing text, seller details, photos or
-- anything the user typed, so none of that is accepted here. The row carries the user's own
-- id so a report can be traced back to a session, and users can read their own rows only.

create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source text not null,
  message text not null,
  view text,
  detail text,
  app_version text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists error_events_recent_idx on public.error_events (created_at desc);

alter table public.error_events enable row level security;

drop policy if exists error_events_own_insert on public.error_events;
create policy error_events_own_insert on public.error_events
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists error_events_own_read on public.error_events;
create policy error_events_own_read on public.error_events
  for select to authenticated
  using (user_id = auth.uid());
