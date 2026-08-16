insert into public.reward_catalog (id, category, rarity_id, display_name, description)
values
  ('frame_royal_gold', 'avatar_decoration', 'legendary', 'Лавр', 'Тонкий лавровый ободок вокруг аватара'),
  ('badge_crown', 'badge', 'legendary', 'Император', 'Знак высокого статуса'),
  ('glow_solar', 'profile_effect', 'legendary', 'Полдень', 'Тёплый дневной свет на карточке'),
  ('frame_inferno_flame', 'avatar_decoration', 'mythic', 'Уголёк', 'Тёплый след активности'),
  ('badge_fire', 'badge', 'mythic', 'Пламя', 'Знак яркой активности'),
  ('frame_cyber_wave', 'avatar_decoration', 'epic', 'Сигнал', 'Кольцо набора сообщения'),
  ('badge_diamond', 'badge', 'epic', 'Алмаз', 'Грань коллекционного знака'),
  ('glow_amethyst', 'profile_effect', 'epic', 'Чернила', 'Глубокая чернильная заливка'),
  ('frame_amethyst_crystal', 'avatar_decoration', 'rare', 'Сургуч', 'Оттиск печати у аватара'),
  ('badge_lightning', 'badge', 'rare', 'Искра', 'Короткий импульс'),
  ('glow_sapphire', 'profile_effect', 'rare', 'Иней', 'Холодная бумажная полоса'),
  ('frame_neon_cyan', 'avatar_decoration', 'standard', 'Волна', 'Линия входящего сообщения'),
  ('frame_emerald_shield', 'avatar_decoration', 'standard', 'Тучка', 'Маленькая тучка над аватаром'),
  ('badge_rocket', 'badge', 'standard', 'Ракета', 'Знак нового чата'),
  ('badge_coin', 'badge', 'standard', 'Пионер', 'Первый знак Coiny'),
  ('frame_lunar_moths', 'avatar_decoration', 'mythic', 'Мотыльки', 'Два силуэта у рамки'),
  ('glow_quantum_grid', 'profile_effect', 'mythic', 'Сетка', 'Тихая клетчатая бумага'),
  ('frame_sakura_bloom', 'avatar_decoration', 'epic', 'Сакура', 'Три лепестка на ободке'),
  ('badge_phoenix', 'badge', 'epic', 'Феникс', 'Знак возвращения'),
  ('glow_sakura_dream', 'profile_effect', 'rare', 'Рассвет', 'Розовая бумажная заливка'),
  ('frame_clockwork_orbit', 'avatar_decoration', 'rare', 'Часы', 'Четыре насечки как циферблат'),
  ('badge_comet', 'badge', 'rare', 'Комета', 'Знак дальнего пути'),
  ('glow_ocean_depth', 'profile_effect', 'standard', 'Глубина', 'Тёмная морская бумага'),
  ('badge_moon', 'badge', 'standard', 'Полуночник', 'Ночной знак')
on conflict (id) do update
set
  category = excluded.category,
  rarity_id = excluded.rarity_id,
  display_name = excluded.display_name,
  description = excluded.description;
