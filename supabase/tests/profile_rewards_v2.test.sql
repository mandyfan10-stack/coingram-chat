begin;
select plan(10);

select hasnt_table('public', 'reward_rarities', 'reward rarity table is removed');
select hasnt_table('public', 'reward_catalog', 'reward catalog table is removed');
select hasnt_table('public', 'user_reward_accounts', 'reward account table is removed');
select hasnt_table('public', 'user_collectibles', 'collectibles table is removed');
select hasnt_table('public', 'profile_cosmetics', 'profile cosmetics table is removed');

select hasnt_function('public', 'open_profile_booster', 'booster rpc is removed');
select hasnt_function('public', 'record_reward_activity', 'reward heartbeat rpc is removed');
select hasnt_function('public', 'claim_reward_refill', 'reward refill rpc is removed');
select hasnt_function('public', 'set_profile_cosmetic', 'catalog equip rpc is removed');
select hasnt_function('public', 'set_profile_style', 'custom style rpc is removed');

select * from finish();
rollback;
