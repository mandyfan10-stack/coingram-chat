import { supabase, isSupabaseConfigured, isMockMode } from '../supabaseClient';
import {
  validateAuthUsername,
  validateAuthEmail,
  buildSignupAuthEmail,
  buildSignInEmailCandidates,
  hashMockPassword,
  mockPasswordMatches
} from './authEmail';
function isInvalidCredentialsError(error) {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const status = error.status || error.statusCode;
  return status === 400
    || message.includes('invalid login credentials')
    || message.includes('invalid_credentials')
    || message.includes('email not confirmed');
}

export const authService = {
  signUp: async (username, password, displayName) => {
    const validated = validateAuthUsername(username);
    if (!validated.ok) return { error: new Error(validated.error) };
    const cleanUsername = validated.username;

    if (isSupabaseConfigured) {
      const email = buildSignupAuthEmail(cleanUsername);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: displayName,
            auth_email_scheme: 'modern_v1'
          }
        }
      });
      if (error) return { error };
      return { data: { id: data.user.id, name: displayName, username: cleanUsername } };
    }

    // Mock / offline demo
    const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
    if (mockUsers.some((u) => u.username === cleanUsername)) {
      return { error: new Error('Данное имя пользователя уже занято!') };
    }
    const passwordHash = await hashMockPassword(password);
    const newUser = {
      id: `user-mock-${Date.now()}`,
      username: cleanUsername,
      name: displayName,
      passwordHash,
      avatarColor: 'linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%)',
      bio: '',
      theme: 'telegram-blue',
      wallpaper: 'classic',
      avatar: '🪙'
    };
    mockUsers.push(newUser);
    localStorage.setItem('tg-mock-users', JSON.stringify(mockUsers));
    const { passwordHash: _, ...publicUser } = newUser;
    return { data: publicUser };
  },

  signIn: async (identifier, password) => {
    const rawIdentifier = String(identifier || '').trim();
    const isEmailIdentifier = rawIdentifier.includes('@');
    const validated = isEmailIdentifier
      ? validateAuthEmail(rawIdentifier)
      : validateAuthUsername(rawIdentifier);
    if (!validated.ok) return { error: new Error(validated.error) };

    if (isSupabaseConfigured) {
      if (isEmailIdentifier) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: validated.email,
          password
        });
        if (error) return { error };
        return { data: { id: data.user.id } };
      }

      const cleanUsername = validated.username;
      const candidates = buildSignInEmailCandidates(cleanUsername);
      let lastError = null;

      for (const email of candidates) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (!error) {
          return { data: { id: data.user.id } };
        }
        lastError = error;
        // Only fall through to the next email scheme on credential failures.
        if (!isInvalidCredentialsError(error)) {
          return { error };
        }
      }

      return { error: lastError || new Error('Ошибка при входе. Проверьте логин и пароль.') };
    }

    if (isEmailIdentifier) {
      return { error: new Error('В демо-режиме вход по email недоступен. Используйте никнейм.') };
    }

    const cleanUsername = validated.username;

    // Mock / offline demo
    let mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
    let user = null;
    for (const candidate of mockUsers) {
      if (candidate.username !== cleanUsername) continue;
      if (await mockPasswordMatches(candidate, password)) {
        user = candidate;
        break;
      }
    }

    // Demo convenience: first-time username+password creates a local account.
    // Only when mock mode is allowed (never on misconfigured production).
    if (!user) {
      if (!isMockMode) {
        return { error: new Error('Неверный логин или пароль.') };
      }

      const passwordHash = await hashMockPassword(password);
      const newUser = {
        id: `user-mock-${Date.now()}`,
        username: cleanUsername,
        name: cleanUsername,
        passwordHash,
        avatarColor: 'linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%)',
        bio: '',
        theme: 'telegram-blue',
        wallpaper: 'classic',
        avatar: '🪙'
      };
      mockUsers.push(newUser);
      localStorage.setItem('tg-mock-users', JSON.stringify(mockUsers));
      user = newUser;
    } else if (user.password && !user.passwordHash) {
      // One-time migration: drop plaintext password from mock store
      const passwordHash = await hashMockPassword(password);
      mockUsers = mockUsers.map((u) => {
        if (u.username !== user.username) return u;
        const { password: _pw, ...rest } = u;
        return { ...rest, passwordHash };
      });
      localStorage.setItem('tg-mock-users', JSON.stringify(mockUsers));
      user = mockUsers.find((u) => u.username === cleanUsername);
    }

    const { password: _p, passwordHash: _h, ...cleanUser } = user;
    localStorage.setItem('tg-user-mock', JSON.stringify(cleanUser));
    return { data: cleanUser };
  },

  signOut: async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('tg-user-mock');
    }
  },

  fetchProfile: async (userId) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, bio, avatar_color, theme, wallpaper, avatar, banner, banner_path, public_key, has_e2ee')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    const savedUser = localStorage.getItem('tg-user-mock');
    return savedUser ? JSON.parse(savedUser) : null;
  },

  updateProfile: async (userId, fields) => {
    if (isSupabaseConfigured) {
      const payload = {
        display_name: fields.name,
        bio: fields.bio,
        avatar_color: fields.avatarColor,
        theme: fields.theme,
        wallpaper: fields.wallpaper,
        avatar: fields.avatar,
        banner: fields.banner,
        public_key: fields.public_key ?? fields.publicKey,
        has_e2ee: fields.has_e2ee ?? fields.hasE2EE
      };
      Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId);
      if (error) throw error;
      return;
    }

    const savedUser = localStorage.getItem('tg-user-mock');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      const updated = { ...parsed, ...fields };
      localStorage.setItem('tg-user-mock', JSON.stringify(updated));

      const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
      const idx = mockUsers.findIndex((u) => u.username === parsed.username);
      if (idx !== -1) {
        const next = { ...mockUsers[idx], ...fields };
        delete next.password;
        mockUsers[idx] = next;
        localStorage.setItem('tg-mock-users', JSON.stringify(mockUsers));
      }
    }
  },

  saveE2EEBackup: async (userId, encryptedPrivKeyStr) => {
    if (isSupabaseConfigured) {
      const parsed = JSON.parse(encryptedPrivKeyStr);
      const targetTable = parsed.version === 2 ? 'e2ee_recovery_backups' : 'user_private_keys';
      const record = parsed.version === 2
        ? {
            user_id: userId,
            format_version: 2,
            kdf: 'argon2id',
            kdf_parameters: parsed.password_backup?.parameters || {},
            encrypted_backup: encryptedPrivKeyStr,
            updated_at: new Date().toISOString()
          }
        : { id: userId, encrypted_private_key: encryptedPrivKeyStr };
      const { error } = await supabase.from(targetTable).upsert(record);
      if (error) throw error;
    } else {
      localStorage.setItem(`coingram-backup-privkey-${userId}`, encryptedPrivKeyStr);
    }
  },

  getE2EEBackup: async (userId) => {
    if (isSupabaseConfigured) {
      const { data: current, error: currentError } = await supabase
        .from('e2ee_recovery_backups')
        .select('encrypted_backup')
        .eq('user_id', userId)
        .maybeSingle();
      if (currentError) throw currentError;
      if (current?.encrypted_backup) return current.encrypted_backup;
      const { data: legacy, error: legacyError } = await supabase
        .from('user_private_keys')
        .select('encrypted_private_key')
        .eq('id', userId)
        .maybeSingle();
      if (legacyError) throw legacyError;
      return legacy?.encrypted_private_key || null;
    }
    return localStorage.getItem(`coingram-backup-privkey-${userId}`);
  },

  deleteE2EEBackup: async (userId) => {
    if (isSupabaseConfigured) {
      const [current, legacy] = await Promise.all([
        supabase.from('e2ee_recovery_backups').delete().eq('user_id', userId),
        supabase.from('user_private_keys').delete().eq('id', userId)
      ]);
      if (current.error || legacy.error) throw current.error || legacy.error;
    } else {
      localStorage.removeItem(`coingram-backup-privkey-${userId}`);
    }
  }
};
