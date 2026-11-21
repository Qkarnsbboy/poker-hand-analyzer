/// <reference types="vite/client" />

// Values from frontend/.env.local (see frontend/.env.example).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}
