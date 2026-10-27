/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_STORAGE_MODE?: 'local' | 'supabase'
  readonly VITE_DEMO_LOGIN?: 'true' | 'false'
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
