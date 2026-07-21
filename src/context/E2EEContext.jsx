import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { dataService } from '../services/dataLayer';
import { 
  generateE2EEKeyPair, 
  exportPublicKey, 
  backupPrivateKey, 
  restorePrivateKey, 
  generateRecoveryCode,
  importPrivateKey
} from '../utils/e2eeHelper';
import { savePrivateKey, getPrivateKey, deletePrivateKey } from '../utils/indexedDbHelper';

const E2EEContext = createContext();

export const E2EEProvider = ({ children }) => {
  const { currentUser, setCurrentUser } = useAuth();
  const [e2eePrivateKey, setE2eePrivateKey] = useState(null);
  const [sharedKeysCache, setSharedKeysCache] = useState({});
  const [isE2EESetupRequired, setIsE2EESetupRequired] = useState(false);

  // Monitor currentUser E2EE setup requirements
  useEffect(() => {
    if (currentUser) {
      if (dataService.isLive()) {
        if (!currentUser.has_e2ee || !currentUser.public_key) {
          setIsE2EESetupRequired(true);
        } else {
          setIsE2EESetupRequired(false);
        }
      }
    } else {
      setIsE2EESetupRequired(false);
      setE2eePrivateKey(null);
      setSharedKeysCache({});
    }
  }, [currentUser]);

  // Load secure E2EE private key from IndexedDB on startup
  useEffect(() => {
    const tryRestorePrivateKey = async () => {
      if (currentUser && currentUser.has_e2ee && !e2eePrivateKey) {
        try {
          // 1. Try IndexedDB first
          let restoredKey = await getPrivateKey(currentUser.id);
          
          // 2. Fallback to localStorage/sessionStorage (migration)
          const cacheKey = `coingram-e2ee-key-${currentUser.id}`;
          if (!restoredKey) {
            let cachedJwk = sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey);
            if (cachedJwk) {
              // Import key with extractable = false for runtime security
              restoredKey = await importPrivateKey(cachedJwk, false);
              
              // Migrate to IndexedDB
              await savePrivateKey(currentUser.id, restoredKey);
              
              // Clean up legacy plaintext storage
              sessionStorage.removeItem(cacheKey);
              localStorage.removeItem(cacheKey);
              console.log("Migrated E2EE Private Key from localStorage to IndexedDB.");
            }
          }

          if (restoredKey) {
            setE2eePrivateKey(restoredKey);
            console.log("E2EE Private Key loaded securely from IndexedDB.");
          }
        } catch (e) {
          console.warn("Failed to restore E2EE key from IndexedDB:", e);
        }
      }
    };
    tryRestorePrivateKey();
  }, [currentUser, e2eePrivateKey]);

  const setupE2EE = useCallback(async (password) => {
    if (!currentUser) return null;
    try {
      // 1. Generate keys (extractable = true for backup phase)
      const keyPair = await generateE2EEKeyPair();
      const recoveryCode = generateRecoveryCode();
      const encryptedPrivKeyStr = await backupPrivateKey(keyPair.privateKey, password, recoveryCode);
      const pubKeyStr = await exportPublicKey(keyPair.publicKey);

      // 2. Write backup to secure user_private_keys table
      await dataService.saveE2EEBackup(currentUser.id, encryptedPrivKeyStr);

      // 3. Update profile public key
      await dataService.updateProfile(currentUser.id, {
        public_key: pubKeyStr,
        has_e2ee: true
      });

      // 4. Create secure non-extractable instance of private key for memory & IndexedDB
      const jwkStr = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
      const securePrivKey = await window.crypto.subtle.importKey(
        'jwk',
        jwkStr,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, // non-extractable
        ['deriveKey', 'deriveBits']
      );

      // 5. Store securely
      await savePrivateKey(currentUser.id, securePrivKey);
      setE2eePrivateKey(securePrivKey);
      setIsE2EESetupRequired(false);

      setCurrentUser(prev => ({
        ...prev,
        has_e2ee: true,
        public_key: pubKeyStr
      }));
      return { success: true, recoveryCode };
    } catch (e) {
      console.error("E2EE Setup failed:", e);
      alert("Не удалось настроить шифрование: " + e.message);
      return null;
    }
  }, [currentUser, setCurrentUser]);

  const unlockE2EE = useCallback(async (passwordOrCode, isRecovery = false) => {
    if (!currentUser) return false;
    try {
      const encryptedPrivKeyStr = await dataService.getE2EEBackup(currentUser.id);
      if (!encryptedPrivKeyStr) return false;

      // 1. Decrypt private key
      const decryptedKey = await restorePrivateKey(encryptedPrivKeyStr, passwordOrCode, isRecovery);
      
      // 2. Import it as non-extractable for security
      const jwkStr = await window.crypto.subtle.exportKey('jwk', decryptedKey);
      const securePrivKey = await window.crypto.subtle.importKey(
        'jwk',
        jwkStr,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, // non-extractable
        ['deriveKey', 'deriveBits']
      );

      // 3. Store securely in IndexedDB and memory
      await savePrivateKey(currentUser.id, securePrivKey);
      setE2eePrivateKey(securePrivKey);
      return true;
    } catch (e) {
      console.error("E2EE Unlock failed (wrong password/recovery code?):", e);
      return false;
    }
  }, [currentUser]);

  const changePasswordAfterRecovery = useCallback(async (recoveryCode, newPassword) => {
    if (!currentUser || !e2eePrivateKey) return false;
    try {
      // Temporarily import private key as extractable to build the new backup
      // Wait, e2eePrivateKey in memory is non-extractable, we cannot export it!
      // But wait: if we did recovery, we already entered the recoveryCode and unlocked it.
      // So we have the decrypted key at that moment!
      // Let's pass the raw decrypted key or decrypt it again from backup using recoveryCode.
      const encryptedPrivKeyStr = await dataService.getE2EEBackup(currentUser.id);
      const decryptedKey = await restorePrivateKey(encryptedPrivKeyStr, recoveryCode, true);
      
      const newBackupStr = await backupPrivateKey(decryptedKey, newPassword, recoveryCode);
      await dataService.saveE2EEBackup(currentUser.id, newBackupStr);
      return true;
    } catch (e) {
      console.error("Failed to change password after E2EE recovery:", e);
      return false;
    }
  }, [currentUser, e2eePrivateKey]);

  const resetE2EE = useCallback(async () => {
    if (!currentUser) return false;
    try {
      await dataService.deleteE2EEBackup(currentUser.id);
      await dataService.updateProfile(currentUser.id, {
        public_key: null,
        has_e2ee: false
      });
      await deletePrivateKey(currentUser.id);

      setE2eePrivateKey(null);
      setSharedKeysCache({});
      setIsE2EESetupRequired(true);

      setCurrentUser(prev => ({
        ...prev,
        has_e2ee: false,
        public_key: null
      }));
      return true;
    } catch (e) {
      console.error("E2EE Reset failed:", e);
      alert("Не удалось сбросить шифрование: " + e.message);
      return false;
    }
  }, [currentUser, setCurrentUser]);

  return (
    <E2EEContext.Provider value={{
      e2eePrivateKey,
      setE2eePrivateKey,
      sharedKeysCache,
      setSharedKeysCache,
      isE2EESetupRequired,
      setupE2EE,
      unlockE2EE,
      changePasswordAfterRecovery,
      resetE2EE
    }}>
      {children}
    </E2EEContext.Provider>
  );
};

export const useE2EE = () => useContext(E2EEContext);
