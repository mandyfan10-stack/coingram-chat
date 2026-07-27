-- Richer in-Pulse watch signals for taste ranking
alter table public.pulse_views
  add column if not exists watched_sec real not null default 0,
  add column if not exists duration_sec integer,
  add column if not exists completed boolean not null default false,
  add column if not exists skipped boolean not null default false;

comment on column public.pulse_views.watched_sec is 'Max playback position seconds observed';
comment on column public.pulse_views.completed is 'User reached ~65%+ of the video';
comment on column public.pulse_views.skipped is 'User left almost immediately';
