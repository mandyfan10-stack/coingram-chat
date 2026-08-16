import { createClient } from '@supabase/supabase-js';

// Supabase is opt-in. Without both values the app deliberately runs in the
// local mock mode described in README instead of silently connecting to a
// production project — but only outside production builds.
const viteEnv = import.meta.env || {};
const isProduction = Boolean(import.meta.env && import.meta.env.PROD);
export const supabaseProjectUrl = String(viteEnv.VITE_SUPABASE_URL || '').trim();
const supabasePublishableKey = String(
  viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  viteEnv.VITE_SUPABASE_ANON_KEY ||
  '',
).trim();

/** Explicit escape hatch for rare production demo builds without Supabase. */
export const allowMockInProduction =
  String(viteEnv.VITE_ALLOW_MOCK || '').trim().toLowerCase() === 'true' ||
  String(viteEnv.VITE_ALLOW_MOCK || '').trim() === '1';

const envForceMock =
  String(viteEnv.VITE_MOCK || viteEnv.VITE_FORCE_MOCK || '').trim().toLowerCase() === 'true' ||
  String(viteEnv.VITE_MOCK || viteEnv.VITE_FORCE_MOCK || '').trim() === '1';

const runtimeMockAllowed = !isProduction || allowMockInProduction;
const runtimeForceMock = runtimeMockAllowed && (
  (typeof window !== 'undefined' && window.location?.search && new URLSearchParams(window.location.search).get('mock') === '1')
  || (typeof window !== 'undefined' && window.localStorage?.getItem?.('coingram_force_mock') === 'true')
);

export const forceMock = envForceMock || runtimeForceMock;

const isConfigured =
  !forceMock &&
  Boolean(supabaseProjectUrl) &&
  Boolean(supabasePublishableKey) &&
  supabaseProjectUrl !== 'your-supabase-project-url' &&
  supabasePublishableKey !== 'your-supabase-publishable-key' &&
  supabasePublishableKey !== 'your-supabase-anon-key';

export const isSupabaseConfigured = !!isConfigured;

/**
 * Interactive localStorage demo. Allowed in dev always when Supabase is
 * missing, or in production only with VITE_ALLOW_MOCK=true.
 */
export const isMockMode =
  forceMock || (!isSupabaseConfigured && (!isProduction || allowMockInProduction));

/**
 * Production build shipped without Supabase credentials and without mock
 * escape hatch — must not pretend to be a working messenger.
 */
export const isMisconfigured =
  isProduction && !isSupabaseConfigured && !allowMockInProduction;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseProjectUrl, supabasePublishableKey)
  : null;
