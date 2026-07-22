import { 
  generateE2EEKeyPair, 
  exportPublicKey, 
  importPublicKey, 
  backupPrivateKey, 
  restorePrivateKey, 
  deriveSymmetricKey, 
  encryptMessage, 
  decryptMessage, 
  encryptFile,
  encryptFileForE2EE,
  requireE2EEKey,
  decryptFile 
} from './src/utils/e2eeHelper.js';
import { getAttachmentMimeType, getPrivateAttachmentPath } from './src/utils/storageMedia.js';

async function runTests() {
  console.log("=== STARTING E2EE CRYPTOGRAPHIC UNIT TESTS ===");
  let failed = false;
  
  const assert = (condition, message) => {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      failed = true;
    } else {
      console.log(`✅ PASSED: ${message}`);
    }
  };

  try {
    assert(
      getPrivateAttachmentPath('https://example.test/storage/v1/object/public/chat-attachments/chat/user/file%20name.png?x=1') === 'chat/user/file name.png',
      "Private attachment paths are extracted and decoded"
    );
    assert(
      getPrivateAttachmentPath('https://example.test/storage/v1/object/public/public-media/user/story.png') === null,
      "Public media URLs bypass private attachment loading"
    );
    assert(
      getAttachmentMimeType('https://example.test/file.webp') === 'image/webp',
      "Attachment MIME type is inferred from its extension"
    );

    // Test 1: Key Generation
    const aliceKeys = await generateE2EEKeyPair();
    const bobKeys = await generateE2EEKeyPair();
    
    assert(aliceKeys.privateKey && aliceKeys.publicKey, "Alice keys generated");
    assert(bobKeys.privateKey && bobKeys.publicKey, "Bob keys generated");

    // Test 2: Public Key Export/Import
    const alicePubStr = await exportPublicKey(aliceKeys.publicKey);
    const alicePubImported = await importPublicKey(alicePubStr);
    assert(alicePubStr && typeof alicePubStr === 'string', "Alice public key exported to string");
    assert(alicePubImported, "Alice public key imported back successfully");

    // Test 3: Backup & Restore Private Key (Password & Recovery Code)
    const testPassword = "secure-e2ee-password-123!";
    const testRecoveryCode = "ABCD-EFGH-IJKL-MNOP-QRST-UVWX";
    const backupJson = await backupPrivateKey(aliceKeys.privateKey, testPassword, testRecoveryCode);
    
    assert(backupJson && typeof backupJson === 'string', "Backup generated successfully as JSON string");
    
    // Restore using password
    const restoredWithPwd = await restorePrivateKey(backupJson, testPassword, false);
    assert(restoredWithPwd, "Private key restored successfully using password");

    // Restore using recovery code
    const restoredWithCode = await restorePrivateKey(backupJson, testRecoveryCode, true);
    assert(restoredWithCode, "Private key restored successfully using recovery code");

    // Test 4: Shared Key Derivation (ECDH)
    const bobPubStr = await exportPublicKey(bobKeys.publicKey);
    const bobPubImported = await importPublicKey(bobPubStr);
    
    const aliceSharedKey = await deriveSymmetricKey(aliceKeys.privateKey, bobPubImported);
    const bobSharedKey = await deriveSymmetricKey(bobKeys.privateKey, alicePubImported);
    
    assert(aliceSharedKey && bobSharedKey, "Shared keys derived on both sides");
    
    // Verify derived keys are not extractable (for security)
    assert(aliceSharedKey.extractable === false, "Derived shared key is NOT extractable (secure)");

    // Test 5: Message Encryption & Decryption
    const plaintext = "Hello Bob! This is an E2EE encrypted message on CoinGram.";
    const encrypted = await encryptMessage(plaintext, aliceSharedKey);
    assert(encrypted.ciphertext && encrypted.iv, "Message encrypted successfully");
    
    const decrypted = await decryptMessage(encrypted.ciphertext, encrypted.iv, bobSharedKey);
    assert(decrypted === plaintext, "Message decrypted successfully and matches plaintext");

    // Test 6: File Blob Encryption & Decryption
    const fileContent = new Uint8Array([1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 100, 200]);
    const simulatedFile = new Blob([fileContent], { type: 'image/png' });
    
    const encryptedFileBlob = await encryptFile(simulatedFile, aliceSharedKey);
    assert(encryptedFileBlob && encryptedFileBlob.size > simulatedFile.size, "File encrypted successfully (ciphertext size is larger due to IV)");

    let missingKeyWasBlocked = false;
    try {
      await encryptFileForE2EE(simulatedFile, null);
    } catch (error) {
      missingKeyWasBlocked = error.code === 'E2EE_KEY_UNAVAILABLE';
    }
    assert(missingKeyWasBlocked, "E2EE file upload is blocked when the shared key is unavailable");
    assert(requireE2EEKey(aliceSharedKey) === aliceSharedKey, "Available E2EE key passes the upload guard");

    const guardedEncryptedBlob = await encryptFileForE2EE(simulatedFile, aliceSharedKey);
    assert(guardedEncryptedBlob.type === 'application/octet-stream', "E2EE upload guard encrypts files with the shared key");
    
    const decryptedFileBlob = await decryptFile(encryptedFileBlob, bobSharedKey, simulatedFile.type);
    assert(decryptedFileBlob.type === simulatedFile.type, "Decrypted file restores its media type");
    const decryptedArrayBuffer = await decryptedFileBlob.arrayBuffer();
    const decryptedBytes = new Uint8Array(decryptedArrayBuffer);
    
    let bytesMatch = decryptedBytes.length === fileContent.length;
    if (bytesMatch) {
      for (let i = 0; i < fileContent.length; i++) {
        if (decryptedBytes[i] !== fileContent[i]) {
          bytesMatch = false;
          break;
        }
      }
    }
    assert(bytesMatch, "File decrypted successfully and matches original file bytes");

  } catch (err) {
    console.error("CRITICAL ERROR IN TEST TRAJECTORY:", err);
    failed = true;
  }

  if (failed) {
    console.error("\n❌ SOME TESTS FAILED!");
    process.exit(1);
  } else {
    console.log("\n🎉 ALL E2EE CRYPTOGRAPHIC TESTS COMPLETED SUCCESSFULLY!");
    process.exit(0);
  }
}

runTests();
