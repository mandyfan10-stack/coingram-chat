/**
 * Demo bots that exist only in client mock mode (localStorage / offline demo).
 * They must never appear as real Supabase profiles or live chat targets.
 */
export const MOCK_ONLY_BOT_USERNAMES = [
  'echo_bot',
  'quiz_bot',
  'weather_bot'
] as const;

export const MOCK_ONLY_BOT_USERNAME_SET = new Set<string>(MOCK_ONLY_BOT_USERNAMES);

/** Fixed UUIDs historically seeded into public.profiles (legacy schema). */
export const MOCK_ONLY_BOT_PROFILE_IDS = [
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005'
] as const;

export const MOCK_ONLY_BOT_PROFILE_ID_SET = new Set<string>(MOCK_ONLY_BOT_PROFILE_IDS);

export function isMockOnlyBotUsername(username: string | null | undefined): boolean {
  const clean = String(username || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
  return MOCK_ONLY_BOT_USERNAME_SET.has(clean);
}

export function isMockOnlyBotProfile(profile: {
  id?: string | null;
  username?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  if (profile.id && MOCK_ONLY_BOT_PROFILE_ID_SET.has(String(profile.id))) return true;
  return isMockOnlyBotUsername(profile.username);
}
