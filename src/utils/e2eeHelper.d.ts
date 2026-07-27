/** Typed surface for the E2EE helper (implementation remains e2eeHelper.js). */

export function generateE2EEKeyPair(): Promise<CryptoKeyPair>;
export function exportPublicKey(key: CryptoKey): Promise<string>;
export function importPublicKey(jwkString: string): Promise<CryptoKey>;
export function exportPrivateKey(key: CryptoKey): Promise<string>;
export function importPrivateKey(jwkString: string): Promise<CryptoKey>;
export function generateRecoveryCode(): string;
export function backupPrivateKey(
  privateKey: CryptoKey,
  password: string,
  recoveryCode: string
): Promise<string>;
export function restorePrivateKey(
  backupJsonString: string,
  secret: string,
  isRecovery?: boolean
): Promise<CryptoKey>;
export function deriveSymmetricKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey>;
export function encryptMessage(
  text: string,
  sharedKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }>;
export function decryptMessage(
  ciphertext: string,
  iv: string,
  sharedKey: CryptoKey
): Promise<string>;
export function encryptFile(fileBlob: Blob, aesKey: CryptoKey): Promise<Blob>;
export function encryptFileForE2EE(fileBlob: Blob, aesKey: CryptoKey): Promise<Blob>;
export function decryptFile(
  encryptedBlob: Blob,
  aesKey: CryptoKey,
  outputType?: string
): Promise<Blob>;
export function requireE2EEKey(aesKey: CryptoKey | null | undefined): asserts aesKey is CryptoKey;
