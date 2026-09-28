-- eBay finds (v0.155)
--
-- Each user's own sourcing searches. Retail flips are shared with everyone, so the good ones
-- go fast; a search only this user runs is a market only this user is watching. Stored on the
-- profile so it follows them between devices, and covered by the existing profiles RLS - a
-- user can only ever read or write their own row.
alter table public.profiles add column if not exists ebay_searches text[];
