import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;
let adminClientFingerprint = "";

export function getEffectiveSupabaseUrl(): string {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
}

/**
 * Server-side operations MUST use a server-only Supabase secret key (preferred)
 * or the legacy service-role key. Never fall back to the browser anon/publishable
 * key because that silently changes authorization and can make persistence appear
 * to work while RLS rejects privileged writes.
 */
export function getEffectiveSupabaseKey(): string {
  return (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export function isSupabaseAdminConfigured(): boolean {
  const url = getEffectiveSupabaseUrl();
  const key = getEffectiveSupabaseKey();
  return Boolean(
    url &&
    key &&
    /^https:\/\/[^\s]+\.supabase\.co(?:\/.*)?$/i.test(url) &&
    !key.includes("placeholder")
  );
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = getEffectiveSupabaseUrl();
  const key = getEffectiveSupabaseKey();
  if (!url || !key) {
    throw new Error("SUPABASE_URL and a server-only Supabase secret/service-role key must be configured on the server.");
  }

  const fingerprint = `${url}|${key.slice(0, 12)}`;
  if (adminClient && adminClientFingerprint === fingerprint) return adminClient;

  adminClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "ai-contracts-server",
      },
    },
  });
  adminClientFingerprint = fingerprint;
  return adminClient;
}
