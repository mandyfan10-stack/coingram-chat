import { supabase } from '../supabaseClient.js';
import type { ConversationCryptoState, DeviceIdentity, HistoryTransferManifest } from '../types/e2eeV2';

function requireLiveClient() {
  if (!supabase) throw new Error('E2EE v2 requires a configured Supabase project.');
  return supabase;
}

function binary(value: string): string {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Invalid binary payload.');
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  return `\\x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function sha256Base64(value: string): Promise<string> {
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return btoa(String.fromCharCode(...digest));
}

export const e2eeV2Service = {
  async registerDevice(userId: string, registration: {
    deviceName: string;
    credential: string;
    certificate: string;
    certificateSignature: string;
    identityKey: string;
    keyPackages?: string[];
  }): Promise<DeviceIdentity> {
    const client = requireLiveClient();
    const { error: identityError } = await client.from('e2ee_identities').upsert({
      user_id: userId,
      identity_key: binary(registration.identityKey),
      updated_at: new Date().toISOString()
    });
    if (identityError) throw identityError;
    const { data: device, error } = await client.from('user_devices').insert({
      user_id: userId,
      device_name: registration.deviceName,
      credential: binary(registration.credential),
      certificate: binary(registration.certificate),
      certificate_signature: binary(registration.certificateSignature),
      status: 'pending'
    }).select().single();
    if (error) throw error;

    const packages = registration.keyPackages || [];
    if (packages.length) {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: packageError } = await client.from('e2ee_key_packages').insert(packages.map((payload) => ({
        device_id: device.id,
        owner_id: userId,
        key_package: binary(payload),
        expires_at: expiresAt
      })));
      if (packageError) throw packageError;
    }

    const { data: activated } = await client.rpc('activate_initial_e2ee_device', { p_device_id: device.id });
    return {
      deviceId: device.id,
      userId: device.user_id,
      credential: registration.credential,
      status: activated ? 'active' : device.status,
      createdAt: device.created_at,
      approvedAt: activated ? new Date().toISOString() : device.approved_at,
      revokedAt: device.revoked_at
    };
  },

  async approveDevice(approverDeviceId: string, targetDeviceId: string): Promise<void> {
    const { data, error } = await requireLiveClient().rpc('approve_e2ee_device', {
      p_approver_device_id: approverDeviceId,
      p_target_device_id: targetDeviceId
    });
    if (error) throw error;
    if (!data) throw new Error('Device approval was rejected.');
  },

  async revokeDevice(approverDeviceId: string, targetDeviceId: string): Promise<void> {
    const { data, error } = await requireLiveClient().rpc('revoke_e2ee_device', {
      p_approver_device_id: approverDeviceId,
      p_target_device_id: targetDeviceId
    });
    if (error) throw error;
    if (!data) throw new Error('Device revocation was rejected.');
  },

  async activateConversation(state: ConversationCryptoState, userId: string, initialCommit: string): Promise<void> {
    const client = requireLiveClient();
    const deviceId = await import('../utils/indexedDbHelper.js').then(({ getCurrentE2EEDeviceId }) => getCurrentE2EEDeviceId(userId));
    if (!deviceId) throw new Error('Current device is not registered.');
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(atob(initialCommit), (c) => c.charCodeAt(0))));
    const hashBase64 = btoa(String.fromCharCode(...hash));
    const { error } = await client.rpc('activate_e2ee_conversation', {
      p_chat_id: state.chatId,
      p_mls_group_id: binary(state.groupId),
      p_activation_epoch: state.epoch,
      p_sender_device_id: deviceId,
      p_initial_commit: binary(initialCommit),
      p_payload_hash: binary(hashBase64)
    });
    if (error) throw error;
  },

  async createHistoryTransfer(userId: string, manifest: HistoryTransferManifest, encryptedManifest: string, objectPrefix: string): Promise<void> {
    const manifestHash = await sha256Base64(encryptedManifest);
    const { error } = await requireLiveClient().from('device_transfers').insert({
      id: manifest.transferId,
      user_id: userId,
      from_device_id: manifest.fromDeviceId,
      to_device_id: manifest.toDeviceId,
      object_prefix: objectPrefix,
      encrypted_manifest: binary(encryptedManifest),
      manifest_hash: binary(manifestHash),
      chunk_count: manifest.chunkCount,
      transfer_counter: manifest.counter,
      expires_at: manifest.expiresAt
    });
    if (error) throw error;
  }
};
