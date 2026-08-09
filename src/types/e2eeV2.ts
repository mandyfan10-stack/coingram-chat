export type DeviceStatus = 'pending' | 'active' | 'revoked';
export type EncryptedEventType = 'message' | 'reaction' | 'edit' | 'delete' | 'pin' | 'read' | 'typing' | 'call-signal';

export interface CryptoEnvelopeV2 {
  version: 2;
  ciphersuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519';
  chatId: string;
  epoch: number;
  senderDeviceId: string;
  eventType: EncryptedEventType;
  encryptedPayload: string;
  payloadHash: string;
}

export interface DeviceIdentity {
  deviceId: string;
  userId: string;
  credential: string;
  status: DeviceStatus;
  createdAt: string;
  approvedAt?: string | null;
  revokedAt?: string | null;
}

export interface DeviceCertificate {
  version: 1;
  userId: string;
  deviceId: string;
  credential: string;
  issuedAt: string;
  signature: string;
}

export interface ConversationCryptoState {
  chatId: string;
  groupId: string;
  epoch: number;
  protocolVersion: 2;
  serializedState: string;
}

export interface HistoryTransferManifest {
  version: 1;
  transferId: string;
  fromDeviceId: string;
  toDeviceId: string;
  counter: number;
  chunkCount: number;
  chunkHashes: string[];
  totalBytes: number;
  expiresAt: string;
}

export interface E2EEProviderV2Api {
  registerDevice(deviceName: string): Promise<DeviceIdentity>;
  approveDevice(deviceId: string): Promise<void>;
  revokeDevice(deviceId: string): Promise<void>;
  encryptEvent(chatId: string, eventType: EncryptedEventType, payload: unknown): Promise<CryptoEnvelopeV2>;
  decryptEvent(envelope: CryptoEnvelopeV2): Promise<unknown>;
  migrateConversation(chatId: string): Promise<ConversationCryptoState>;
  exportHistoryTransfer(toDeviceId: string): Promise<HistoryTransferManifest>;
  importHistoryTransfer(manifest: HistoryTransferManifest): Promise<void>;
}
