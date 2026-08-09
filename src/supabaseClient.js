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

const isConfigured =
  Boolean(supabaseProjectUrl) &&
  Boolean(supabasePublishableKey) &&
  supabaseProjectUrl !== 'your-supabase-project-url' &&
  supabasePublishableKey !== 'your-supabase-publishable-key' &&
  supabasePublishableKey !== 'your-supabase-anon-key';

/** Explicit escape hatch for rare production demo builds without Supabase. */
export const allowMockInProduction =
  String(viteEnv.VITE_ALLOW_MOCK || '').trim().toLowerCase() === 'true' ||
  String(viteEnv.VITE_ALLOW_MOCK || '').trim() === '1';

export const isSupabaseConfigured = !!isConfigured;

/**
 * Interactive localStorage demo. Allowed in dev always when Supabase is
 * missing, or in production only with VITE_ALLOW_MOCK=true.
 */
export const isMockMode =
  !isSupabaseConfigured && (!isProduction || allowMockInProduction);

/**
 * Production build shipped without Supabase credentials and without mock
 * escape hatch — must not pretend to be a working messenger.
 */
export const isMisconfigured =
  isProduction && !isSupabaseConfigured && !allowMockInProduction;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseProjectUrl, supabasePublishableKey)
  : null;
