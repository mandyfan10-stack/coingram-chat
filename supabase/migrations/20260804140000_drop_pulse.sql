-- Remove Pulse feature: tables, policies, and related objects.
-- Historical pulse_* migrations remain for audit; this migration is the tear-down.

drop table if exists public.pulse_youtube_accounts cascade;
drop table if exists public.pulse_views cascade;
drop table if exists public.pulse_comments cascade;
drop table if exists public.pulse_reactions cascade;
drop table if exists public.pulse_items cascade;
