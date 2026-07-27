-- Replace VEVO / embed-blocked tracks with reliably embeddable public videos

update public.pulse_items set is_active = false;

insert into public.pulse_items (youtube_id, title, tags, duration_sec, is_active) values
  ('aqz-KE-bpKQ', 'Big Buck Bunny', array['film','classic','fun'], 596, true),
  ('eRsGyueVLvQ', 'Sintel', array['film','classic'], 888, true),
  ('wh3rqhy5Hxs', 'Tears of Steel', array['film','scifi'], 734, true),
  ('LXb3EKWsInQ', 'Costa Rica in 4K', array['nature','travel'], 312, true),
  ('jNQXAC9IVRw', 'Me at the zoo', array['classic','short','funny'], 19, true),
  ('M7lc1UVf-VE', 'YouTube Developers Live', array['tech','demo'], 0, true),
  ('ScMzIvxBSi4', 'Peaceful Piano', array['music','calm'], 180, true),
  ('DWcJFNfaw9c', 'Earth From Space', array['nature','space'], 240, true),
  ('hFZFjoX2cGg', 'Caminandes Llama Drama', array['film','fun','short'], 150, true),
  ('YE7VzlLtp-4', 'Big Buck Bunny (short)', array['film','fun','short'], 60, true)
on conflict (youtube_id) do update set
  title = excluded.title,
  tags = excluded.tags,
  duration_sec = excluded.duration_sec,
  is_active = true;
