/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly APP_VERSION: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_E2EE_V2_ENABLED?: string;
  readonly VITE_E2EE_V2_AUDIT_APPROVED?: string;
  readonly VITE_GITHUB_REPO?: string;
  /** YouTube Data API v3 key for infinite Pulse catalog (restrict by HTTP referrer). */
  readonly VITE_YOUTUBE_API_KEY?: string;
  readonly VITE_GOOGLE_API_KEY?: string;
  /** Google OAuth Web client ID — YouTube login for Pulse taste (subscriptions/likes). */
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
