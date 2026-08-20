/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder-project.supabase.co' &&
  import.meta.env.VITE_SUPABASE_ANON_KEY !== 'placeholder-anon-key' &&
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY !== 'placeholder-anon-key'
);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

/**
 * Resolves a valid Supabase Access Token for authenticated server API requests.
 * Handles the initial page load / refresh window where auth state is being
 * restored asynchronously from client storage.
 */
export async function getValidAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) {
    return null;
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session) {
      return null;
    }
    return data.session.access_token;
  } catch (err) {
    console.warn('[AUTH] Unable to obtain Supabase access token:', err);
    return null;
  }
}
