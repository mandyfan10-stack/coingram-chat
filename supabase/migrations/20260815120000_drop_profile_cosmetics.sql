-- Remove custom profile styling, booster economy, and the reward catalog.

drop trigger if exists initialize_profile_rewards on public.profiles;

do $$
begin
  if to_regclass('public.profile_cosmetics') is not null then
    drop trigger if exists validate_profile_cosmetics_categories on public.profile_cosmetics;
  end if;
end $$;

drop function if exists public.set_profile_style(text, text);
drop function if exists private.set_profile_style(text, text);
drop function if exists private.is_own_profile_style_ref(uuid, text, text);
drop function if exists public.open_profile_booster();
drop function if exists private.open_profile_booster();
drop function if exists public.record_reward_activity();
drop function if exists private.record_reward_activity();
drop function if exists public.claim_reward_refill();
drop function if exists private.claim_reward_refill();
drop function if exists public.set_profile_cosmetic(text, text);
drop function if exists private.set_profile_cosmetic(text, text);
drop function if exists private.pick_reward_rarity(numeric);
drop function if exists private.validate_profile_cosmetics_categories();
drop function if exists private.initialize_profile_rewards();
drop function if exists private.ensure_profile_rewards(uuid);

drop table if exists public.user_collectibles;
drop table if exists public.profile_cosmetics;
drop table if exists public.user_reward_accounts;
drop table if exists public.reward_catalog;
drop table if exists public.reward_rarities;

drop policy if exists "Authenticated users read profile cosmetics" on storage.objects;
drop policy if exists "Owners write profile cosmetics" on storage.objects;
drop policy if exists "Owners update profile cosmetics" on storage.objects;
drop policy if exists "Owners delete profile cosmetics" on storage.objects;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'profile-cosmetics') then
    perform storage.delete_prefix('profile-cosmetics', '');
    delete from storage.buckets where id = 'profile-cosmetics';
  end if;
exception
  when others then
    null;
end $$;
