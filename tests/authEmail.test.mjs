import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLegacyAuthEmail,
  buildModernAuthEmail,
  buildSignupAuthEmail,
  buildSignInEmailCandidates,
  validateAuthUsername,
  hashMockPassword,
  mockPasswordMatches,
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

test('mock passwords are compared via hash without requiring plaintext field', async () => {
  const passwordHash = await hashMockPassword('Secret#12345');
  assert.equal(await mockPasswordMatches({ passwordHash }, 'Secret#12345'), true);
  assert.equal(await mockPasswordMatches({ passwordHash }, 'wrong'), false);
  // Legacy plaintext still accepted during migration
  assert.equal(await mockPasswordMatches({ password: 'legacy' }, 'legacy'), true);
});
