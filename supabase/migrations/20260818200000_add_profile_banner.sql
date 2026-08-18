-- Add profile banner support
alter table public.profiles
  add column if not exists banner text,
  add column if not exists banner_path text;
