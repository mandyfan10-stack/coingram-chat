const environment = import.meta.env || {};

export const E2EE_V2_CIPHERSUITE = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const;
export const isE2EEV2Enabled = environment.VITE_E2EE_V2_ENABLED === 'true';
export const isE2EEV2AuditApproved = environment.VITE_E2EE_V2_AUDIT_APPROVED === 'true';
export const e2eeV2ReleaseChannel = isE2EEV2AuditApproved ? 'audited' : 'beta';

export function requireE2EEV2Enabled(): void {
  if (!isE2EEV2Enabled) {
    throw new Error('E2EE v2 is disabled by the release feature flag.');
  }
}
