import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { dataService } from '../services/dataLayer';
import { deletePrivateKey } from '../utils/indexedDbHelper';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const clearE2EECache = useCallback(async (userId) => {
    // Remove from local and session caches
    const cacheKey = `coingram-e2ee-key-${userId}`;
    localStorage.removeItem(cacheKey);
    sessionStorage.removeItem(cacheKey);
    try {
      await deletePrivateKey(userId);
    } catch (e) {
      console.warn("Failed to delete E2EE key from IndexedDB during cache clear:", e);
    }
  }, []);

  // Listen to auth changes (Supabase vs Mock)
  useEffect(() => {
    if (dataService.isLive()) {
      let cancelled = false;
      let authRequestId = 0;

      const applySession = (session) => {
        const requestId = ++authRequestId;

        if (!session) {
          setCurrentUser(previousUser => {
            if (previousUser?.id) {
              void clearE2EECache(previousUser.id);
            }
            return null;
          });
          setAuthLoading(false);
          return;
        }

        // Supabase warns against awaiting other client calls directly inside
        // onAuthStateChange because it can deadlock the auth client.
        setTimeout(async () => {
          try {
            const profile = await dataService.fetchProfile(session.user.id);
            if (cancelled || requestId !== authRequestId) return;
            if (!profile) {
              await supabase.auth.signOut({ scope: 'local' });
              return;
            }

            setCurrentUser({
              id: profile.id,
              name: profile.display_name,
              username: profile.username,
              avatarColor: profile.avatar_color,
              bio: profile.bio,
              theme: profile.theme,
              wallpaper: profile.wallpaper,
              avatar: profile.avatar,
              has_e2ee: profile.has_e2ee,
              public_key: profile.public_key
            });
          } catch (error) {
            if (!cancelled && requestId === authRequestId) {
              const errorCode = error?.code ? ` [${error.code}]` : '';
              console.error(`Failed to load authenticated profile${errorCode}: ${error?.message || String(error)}`);
            }
          } finally {
            if (!cancelled && requestId === authRequestId) {
              setAuthLoading(false);
            }
          }
        }, 0);
      };

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        applySession(session);
      });

      return () => {
        cancelled = true;
        authRequestId += 1;
        subscription?.unsubscribe();
      };
    } else {
      // Mock mode
      const savedUser = localStorage.getItem('tg-user-mock');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch (e) {
          console.warn(e);
        }
      }
      setAuthLoading(false);
    }
  }, [clearE2EECache]);
  const signUpWithUsername = async (username, password, displayName) => {
    return await dataService.signUp(username, password, displayName);
  };

  const signInWithIdentifier = async (identifier, password) => {
    const result = await dataService.signIn(identifier, password);
    if (result.data && !dataService.isLive()) {
      setCurrentUser(result.data);
    }
    return result;
  };

  const signInWithUsername = signInWithIdentifier;

  const logOut = async () => {
    if (currentUser) {
      await clearE2EECache(currentUser.id);
    }
    await dataService.signOut();
    setCurrentUser(null);
  };

  const updateProfile = async (fields) => {
    if (!currentUser) return;
    try {
      await dataService.updateProfile(currentUser.id, fields);
      setCurrentUser(prev => ({ ...prev, ...fields }));
    } catch (e) {
      console.error("Profile update failed", e);
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      setCurrentUser,
      authLoading,
      signUpWithUsername,
      signInWithIdentifier,
      signInWithUsername,
      logOut,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
