-- Google OAuth access tokens are browser-session credentials. They must not
-- be stored in a user-readable application table, even when RLS is enabled.

update public.pulse_youtube_accounts
set access_token = null
where access_token is not null;

alter table public.pulse_youtube_accounts
  drop column if exists access_token,
  drop column if exists expires_at;

comment on table public.pulse_youtube_accounts is
  'YouTube channel metadata and derived taste for Pulse; OAuth credentials are never persisted.';
