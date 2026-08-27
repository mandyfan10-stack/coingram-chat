import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLegacyAuthEmail,
  buildModernAuthEmail,
  buildSignupAuthEmail,
  buildSignInEmailCandidates,
  validateAuthUsername,
  validateAuthEmail,
  hashMockPassword,
  mockPasswordMatches,
  isRetryableSignInSchemeError,
  shouldTryNextAuthEmail,
  mapSupabaseAuthError,
  LEGACY_AUTH_EMAIL_DOMAIN,
  MODERN_AUTH_EMAIL_DOMAIN
} from '../src/services/authEmail.ts';

test('signup uses modern internal email domain, not tg-clone.com', () => {
  const email = buildSignupAuthEmail('alice_dev');
  assert.equal(email, `alice_dev@${MODERN_AUTH_EMAIL_DOMAIN}`);
  assert.doesNotMatch(email, new RegExp(LEGACY_AUTH_EMAIL_DOMAIN));
});

test('sign-in candidates try modern then legacy dual-path', () => {
  const candidates = buildSignInEmailCandidates('Bob_User');
  assert.deepEqual(candidates, [
    `bob_user@${MODERN_AUTH_EMAIL_DOMAIN}`,
    `bob_user@${LEGACY_AUTH_EMAIL_DOMAIN}`
  ]);
});

test('legacy and modern builders normalize username', () => {
  assert.equal(buildLegacyAuthEmail('@Alice'), `alice@${LEGACY_AUTH_EMAIL_DOMAIN}`);
  assert.equal(buildModernAuthEmail(' Alice '), `alice@${MODERN_AUTH_EMAIL_DOMAIN}`);
});

test('username validation rejects invalid local-parts', () => {
  assert.equal(validateAuthUsername('ab').ok, false);
  assert.equal(validateAuthUsername('bad-name').ok, false);
  assert.equal(validateAuthUsername('ok_user1').ok, true);
});

test('email validation supports direct Supabase sign-in', () => {
  assert.deepEqual(validateAuthEmail(' User@Example.COM '), {
    ok: true,
    email: 'user@example.com'
  });
  assert.equal(validateAuthEmail('not-an-email').ok, false);
});

test('username validation rejects mock-only reserved bot names', () => {
  assert.equal(validateAuthUsername('echo_bot').ok, false);
  assert.equal(validateAuthUsername('quiz_bot').ok, false);
  assert.equal(validateAuthUsername('weather_bot').ok, false);
  assert.equal(validateAuthUsername('saved_messages').ok, false);
});

test('dual-path retries only invalid credentials and modern-domain address rejection', () => {
  assert.equal(isRetryableSignInSchemeError({ status: 400, message: 'Invalid login credentials' }), true);
  assert.equal(isRetryableSignInSchemeError({ code: 'invalid_credentials' }), true);
  assert.equal(isRetryableSignInSchemeError({ status: 400, message: 'Email not confirmed' }), false);
  assert.equal(isRetryableSignInSchemeError({ code: 'email_not_confirmed', status: 400 }), false);

  const modern = buildModernAuthEmail('alice');
  const legacy = buildLegacyAuthEmail('alice');
  assert.equal(
    shouldTryNextAuthEmail({ code: 'email_address_invalid', message: 'Example and test domains are currently not supported.' }, modern),
    true
  );
  assert.equal(
    shouldTryNextAuthEmail({ code: 'email_address_invalid' }, legacy),
    false
  );
  assert.equal(
    shouldTryNextAuthEmail({ code: 'email_not_confirmed', message: 'Email not confirmed' }, modern),
    false
  );
});

test('auth errors map to actionable Russian copy', () => {
  assert.match(mapSupabaseAuthError({ message: 'Invalid login credentials' }).message, /Неверный логин или пароль/);
  assert.match(mapSupabaseAuthError({ code: 'email_not_confirmed' }).message, /не подтверждён/i);
  assert.match(mapSupabaseAuthError({ code: 'user_already_exists' }, 'signup').message, /уже занято/);
});

test('mock passwords are compared via hash without requiring plaintext field', async () => {
  const passwordHash = await hashMockPassword('Secret#12345');
  assert.equal(await mockPasswordMatches({ passwordHash }, 'Secret#12345'), true);
  assert.equal(await mockPasswordMatches({ passwordHash }, 'wrong'), false);
  // Legacy plaintext still accepted during migration
  assert.equal(await mockPasswordMatches({ password: 'legacy' }, 'legacy'), true);
});
