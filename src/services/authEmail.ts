/**
 * Supabase Auth requires an email; Coiny is username-first in the UI.
 *
 * Dual-path model:
 * - Legacy accounts:  {username}@tg-clone.com
 * - New accounts:     {username}@coiny.users.local
 *
 * The email is an internal identifier only — never shown as a real mailbox.
 */

export const LEGACY_AUTH_EMAIL_DOMAIN = 'tg-clone.com';
export const MODERN_AUTH_EMAIL_DOMAIN = 'coiny.users.local';

export type UsernameValidationResult =
  | { ok: true; username: string }
  | { ok: false; error: string };

export interface MockUserRecord {
  username?: string;
  password?: string;
  passwordHash?: string;
  [key: string]: unknown;
}

/** Normalize a username for auth (lowercase, strip @). */
export function normalizeAuthUsername(username: string | null | undefined): string {
  return String(username || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

/** Usernames reserved for mock-only demo bots / system (not real accounts). */
export const RESERVED_AUTH_USERNAMES = new Set([
  'echo_bot',
  'quiz_bot',
  'weather_bot',
  'saved_messages',
  'coiny_news'
]);

/**
 * Validate username for auth (must form a safe local-part of an email).
 */
export function validateAuthUsername(username: string | null | undefined): UsernameValidationResult {
  const normalized = normalizeAuthUsername(username);
  if (normalized.length < 3) {
    return { ok: false, error: 'Имя пользователя должно быть не менее 3 символов.' };
  }
  if (normalized.length > 32) {
    return { ok: false, error: 'Имя пользователя должно быть не более 32 символов.' };
  }
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return { ok: false, error: 'Имя пользователя: только латиница, цифры и _.' };
  }
  if (RESERVED_AUTH_USERNAMES.has(normalized)) {
    return { ok: false, error: 'Это имя пользователя зарезервировано.' };
  }
  return { ok: true, username: normalized };
}

export function buildLegacyAuthEmail(username: string): string {
  return `${normalizeAuthUsername(username)}@${LEGACY_AUTH_EMAIL_DOMAIN}`;
}

export function buildModernAuthEmail(username: string): string {
  return `${normalizeAuthUsername(username)}@${MODERN_AUTH_EMAIL_DOMAIN}`;
}

/** Email used for new registrations (modern domain). */
export function buildSignupAuthEmail(username: string): string {
  return buildModernAuthEmail(username);
}

/**
 * Ordered candidate emails for sign-in (modern first, then legacy).
 */
export function buildSignInEmailCandidates(username: string): string[] {
  const modern = buildModernAuthEmail(username);
  const legacy = buildLegacyAuthEmail(username);
  return modern === legacy ? [modern] : [modern, legacy];
}

/**
 * SHA-256 hex digest for mock-mode password storage (never plaintext in localStorage).
 */
export async function hashMockPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(String(password));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Compare a mock user record against a password (hash or legacy plaintext). */
export async function mockPasswordMatches(
  user: MockUserRecord | null | undefined,
  password: string
): Promise<boolean> {
  if (!user) return false;
  const incoming = await hashMockPassword(password);
  if (user.passwordHash && user.passwordHash === incoming) return true;
  if (user.password && user.password === password) return true;
  return false;
}
