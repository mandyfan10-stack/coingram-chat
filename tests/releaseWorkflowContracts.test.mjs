import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');

test('release workflow runs for semantic version tags', () => {
  assert.match(workflow, /tags:\s*\n\s*- 'v\*\.\*\.\*'/);
  assert.match(workflow, /npm run release:verify -- "\$GITHUB_REF_NAME"/);
});

test('ordinary and annotated git tags are accepted', () => {
  assert.doesNotMatch(workflow, /git verify-tag/);
  assert.match(workflow, /git rev-parse --verify "refs\/tags\/\$\{GITHUB_REF_NAME\}\^\{commit\}"/);
});

test('signed Android APK is a required release artifact', () => {
  assert.match(workflow, /Build signed Android APK/);
  assert.match(workflow, /"\$APKSIGNER" verify --verbose/);
  assert.match(workflow, /release\/\*\.apk/);
  assert.match(workflow, /Required Android APK is missing or empty/);
});

test('Electron EXE is a required release artifact', () => {
  assert.match(workflow, /Build Windows installer/);
  assert.match(workflow, /release\/\*\.exe/);
  assert.match(workflow, /Required Electron EXE is missing or empty/);
});

test('release is published only after both installers and deployment succeed', () => {
  assert.match(workflow, /needs:\s*\n\s*- android\s*\n\s*- windows\s*\n\s*- deploy/);
  assert.match(workflow, /gh release create "\$GITHUB_REF_NAME" release-assets\/\*/);
  assert.match(workflow, /--verify-tag/);
  assert.match(workflow, /--generate-notes/);
});

test('release validation runs only live E2E specs', () => {
  assert.match(workflow, /npx playwright test[\s\S]*two-user-call\.spec\.mjs[\s\S]*two-user-read-receipt\.spec\.mjs[\s\S]*reaction-drawer-layout\.spec\.mjs/);
  const liveStep = workflow.match(/- name: Run mandatory live E2E[\s\S]*?(?=\n\s*- name:)/)?.[0] ?? '';
  assert.doesNotMatch(liveStep, /lazy-loading|profile-rewards|message-send|npm run test:e2e/);
});

test('release validation serializes access to shared live E2E accounts', () => {
  const validateJob = workflow.match(/\n  validate:[\s\S]*?(?=\n  [a-z][\w-]*:)/)?.[0] ?? '';
  assert.match(validateJob, /concurrency:\s*\n\s*group: coingram-live-e2e-shared-accounts/);
  assert.match(validateJob, /cancel-in-progress: false/);
});
