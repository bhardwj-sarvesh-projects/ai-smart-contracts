-- AI Contracts: Groq-only credential pool and locked model routing
-- Apply after the existing Supabase migrations.
-- This migration is safe to run more than once.

CREATE TABLE IF NOT EXISTS public.ai_credentials (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'groq',
  provider_label TEXT NOT NULL DEFAULT 'Groq',
  model TEXT NOT NULL DEFAULT 'platform-managed',
  base_url TEXT NOT NULL DEFAULT 'https://api.groq.com/openai/v1',
  display_name TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  api_key_fingerprint TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  last_latency_ms INTEGER,
  cooldown_until TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_failures INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_credentials
  ADD COLUMN IF NOT EXISTS provider_label TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS base_url TEXT,
  ADD COLUMN IF NOT EXISTS api_key_fingerprint TEXT;

UPDATE public.ai_credentials
SET
  provider_label = 'Groq',
  model = 'platform-managed',
  base_url = 'https://api.groq.com/openai/v1'
WHERE provider = 'groq' OR provider IS NULL;

-- Legacy non-Groq credentials are no longer part of the production router.
-- They are retained for audit/history but disabled so they cannot execute.
UPDATE public.ai_credentials
SET enabled = false,
    updated_at = NOW()
WHERE LOWER(COALESCE(provider, '')) <> 'groq';

ALTER TABLE public.ai_credentials
  ALTER COLUMN provider SET DEFAULT 'groq',
  ALTER COLUMN provider_label SET DEFAULT 'Groq',
  ALTER COLUMN model SET DEFAULT 'platform-managed',
  ALTER COLUMN base_url SET DEFAULT 'https://api.groq.com/openai/v1';

CREATE INDEX IF NOT EXISTS idx_ai_credentials_groq_priority
  ON public.ai_credentials(provider, enabled, priority, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_credentials_groq_key_fingerprint
  ON public.ai_credentials(api_key_fingerprint)
  WHERE api_key_fingerprint IS NOT NULL;

ALTER TABLE public.ai_credentials ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

-- Reuse the hardened admin function when present. The service-role server
-- bypasses RLS, while browser sessions never receive direct credential access.
DROP POLICY IF EXISTS "Admin full access to ai_credentials" ON public.ai_credentials;
CREATE POLICY "Admin full access to ai_credentials" ON public.ai_credentials
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Enforce the platform's 15-key ceiling at the database boundary as well as
-- in the server. This prevents accidental over-provisioning through another
-- privileged SQL client.
CREATE OR REPLACE FUNCTION public.enforce_groq_credential_pool()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  IF LOWER(COALESCE(NEW.provider, '')) <> 'groq' THEN
    RAISE EXCEPTION 'Only Groq credentials are supported by the platform';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO current_count
    FROM public.ai_credentials
    WHERE LOWER(COALESCE(provider, '')) = 'groq';

    IF current_count >= 15 THEN
      RAISE EXCEPTION 'The platform supports a maximum of 15 Groq API credentials';
    END IF;
  END IF;

  NEW.provider := 'groq';
  NEW.provider_label := 'Groq';
  NEW.model := 'platform-managed';
  NEW.base_url := 'https://api.groq.com/openai/v1';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_groq_credential_pool_trigger ON public.ai_credentials;
CREATE TRIGGER enforce_groq_credential_pool_trigger
  BEFORE INSERT OR UPDATE ON public.ai_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_groq_credential_pool();

COMMENT ON TABLE public.ai_credentials IS
  'Server-only encrypted Groq API key pool. Models/endpoints are platform-managed and never selected by administrators.';
COMMENT ON COLUMN public.ai_credentials.api_key_fingerprint IS
  'HMAC-SHA256 fingerprint used only for duplicate-key detection; never the API secret itself.';
COMMENT ON COLUMN public.ai_credentials.model IS
  'Always platform-managed. The authoritative task-to-model policy lives in server/config/aiPolicy.ts.';
