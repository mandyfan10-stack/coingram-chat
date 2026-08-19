import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const supabaseClient = readFileSync(new URL('../src/supabaseClient.js', import.meta.url), 'utf8');
const dropPulseMigration = readFileSync(
  new URL('../supabase/migrations/20260804140000_drop_pulse.sql', import.meta.url),
  'utf8'
);

test('Supabase live mode is opt-in through both environment variables', () => {
  assert.match(supabaseClient, /VITE_SUPABASE_URL/);
  assert.match(supabaseClient, /VITE_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(supabaseClient, /defaultUrl|defaultKey/);
  assert.doesNotMatch(supabaseClient, /https:\/\/[^\s'"`]+\.supabase\.co/);
});

test('profile banners have Data API grants and a dedicated upload kind', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20260819200000_profile_banner_grants.sql', import.meta.url),
    'utf8',
  );
  const sanitize = readFileSync(
    new URL('../supabase/functions/sanitize-public-image/index.ts', import.meta.url),
    'utf8',
  );
  const publicMedia = readFileSync(
    new URL('../src/services/publicMediaService.js', import.meta.url),
    'utf8',
  );
  const storageMedia = readFileSync(
    new URL('../src/utils/storageMedia.js', import.meta.url),
    'utf8',
  );
  assert.match(migration, /grant select \(banner, banner_path\)/);
  assert.match(migration, /grant update \(banner, banner_path\)/);
  assert.match(migration, /'banners'/);
  assert.match(sanitize, /banner: \{ bucket: "banners"/);
  assert.match(sanitize, /update\(\{ banner: reference, banner_path: path \}\)/);
  assert.doesNotMatch(publicMedia, /kind === 'banner' \? 'wallpaper'/);
  assert.match(storageMedia, /'banners'/);
});

test('Tenor client does not embed a Google API key', () => {
  const tenor = readFileSync(
    new URL('../src/services/tenorService.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(tenor, /AIza/);
  assert.match(tenor, /VITE_TENOR_API_KEY/);
});

test('Pulse client surface is fully removed', () => {
  const gone = [
    '../src/components/pulse',
    '../src/hooks/usePulseFeed.js',
    '../src/services/pulseService.js',
    '../src/services/youtubeCatalog.js',
    '../src/services/youtubeAuth.js',
    '../src/utils/pulseRank.js',
    '../src/utils/youtubeApi.js',
  ];
  for (const rel of gone) {
    assert.equal(
      existsSync(path.join(root, rel)),
      false,
      `${rel} must not exist after Pulse removal`,
    );
  }
  assert.match(dropPulseMigration, /drop table if exists public\.pulse_/i);
});
