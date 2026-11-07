// Single place that reads build-time environment (keeps the rest of the app bundler-agnostic).
export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '',
  isProd: import.meta.env.PROD as boolean,
};
