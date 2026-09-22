-- Security: community_intel_follows / community_intel_votes had RLS disabled, so with the default
-- Supabase grants anyone holding the public (publishable) key could read or change them.
-- Only the community-intelligence Edge Function uses these tables, via the service role (which
-- bypasses RLS), so enabling RLS with no policies and removing public grants closes the hole
-- without changing app behaviour.
alter table public.community_intel_follows enable row level security;
alter table public.community_intel_votes enable row level security;
revoke all on public.community_intel_follows from anon, authenticated;
revoke all on public.community_intel_votes from anon, authenticated;
