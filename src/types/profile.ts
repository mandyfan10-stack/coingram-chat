/** User profile as used by the messenger client (mapped from Supabase `profiles`). */
export type ProfileId = string;

export interface Profile {
  id: ProfileId;
  username: string;
  name?: string;
  display_name?: string;
  bio?: string;
  avatar?: string;
  avatarColor?: string;
  avatar_color?: string;
  theme?: string;
  wallpaper?: string;
  banner?: string;
  banner_path?: string;
  lastSeen?: string | null;
  last_seen?: string | null;
  publicKey?: string | null;
  public_key?: string | null;
  hasE2ee?: boolean;
  has_e2ee?: boolean;
  role?: ChatMemberRole;
  notificationsEnabled?: boolean;
}

export type ChatMemberRole = 'member' | 'admin';

export interface ChatMember extends Profile {
  role?: ChatMemberRole;
}
