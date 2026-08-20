-- AI Contracts: final idempotent repair for the 20-key Groq credential pool.
-- Run this once in the Supabase SQL editor if the database was created from
-- an older 15-key/legacy ai_credentials migration. Safe to run repeatedly.

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
  routing_group TEXT,
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
  ADD COLUMN IF NOT EXISTS api_key_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS routing_group TEXT;

UPDATE public.ai_credentials
SET
  provider_label = CASE WHEN LOWER(COALESCE(provider, '')) = 'groq' THEN 'Groq' ELSE COALESCE(provider_label, provider) END,
  model = CASE WHEN LOWER(COALESCE(provider, '')) = 'groq' THEN 'platform-managed' ELSE COALESCE(NULLIF(model, ''), 'legacy-disabled') END,
  base_url = CASE WHEN LOWER(COALESCE(provider, '')) = 'groq' THEN 'https://api.groq.com/openai/v1' ELSE COALESCE(base_url, '') END;

-- Keep only Groq as the production provider. Legacy non-Groq rows remain for
-- audit/history but cannot be used by the production router.
UPDATE public.ai_credentials
SET enabled = false, updated_at = NOW()
WHERE LOWER(COALESCE(provider, '')) <> 'groq';

-- Remove an older slot index before renumbering. This makes the repair safe
-- even when the previous 20-key migration was partially applied.
DROP INDEX IF EXISTS public.uq_ai_credentials_groq_slot;

-- Normalize Groq rows into deterministic slots 1..20 before adding the unique
-- slot index. Existing creation order is preserved as the stable tie-breaker.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY priority ASC NULLS LAST, created_at ASC, id ASC) AS slot
  FROM public.ai_credentials
  WHERE LOWER(COALESCE(provider, '')) = 'groq'
)
UPDATE public.ai_credentials c
SET priority = ranked.slot::INTEGER
FROM ranked
WHERE c.id = ranked.id
  AND ranked.slot <= 20;

-- Any legacy rows beyond the supported pool remain stored but disabled and are
-- assigned a deterministic out-of-pool priority. They can never be routed.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY priority ASC NULLS LAST, created_at ASC, id ASC) AS slot
  FROM public.ai_credentials
  WHERE LOWER(COALESCE(provider, '')) = 'groq'
)
UPDATE public.ai_credentials c
SET enabled = false,
    priority = 1000 + ranked.slot::INTEGER,
    updated_at = NOW()
FROM ranked
WHERE c.id = ranked.id
  AND ranked.slot > 20;

UPDATE public.ai_credentials
SET routing_group = CASE
  WHEN priority BETWEEN 1 AND 3 THEN 'architecture'
  WHEN priority BETWEEN 4 AND 6 THEN 'generation'
  WHEN priority BETWEEN 7 AND 9 THEN 'editing-repair'
  WHEN priority BETWEEN 10 AND 12 THEN 'testing'
  WHEN priority BETWEEN 13 AND 15 THEN 'security'
  WHEN priority BETWEEN 16 AND 18 THEN 'documentation-copilot'
  WHEN priority BETWEEN 19 AND 20 THEN 'research-compile'
  ELSE 'retired'
END;

ALTER TABLE public.ai_credentials
  ALTER COLUMN provider SET DEFAULT 'groq',
  ALTER COLUMN provider_label SET DEFAULT 'Groq',
  ALTER COLUMN model SET DEFAULT 'platform-managed',
  ALTER COLUMN base_url SET DEFAULT 'https://api.groq.com/openai/v1';

ALTER TABLE public.ai_credentials
  ALTER COLUMN routing_group SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_credentials_groq_priority
  ON public.ai_credentials(provider, enabled, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_credentials_routing_group
  ON public.ai_credentials(provider, routing_group, enabled, priority);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_credentials_groq_key_fingerprint
  ON public.ai_credentials(api_key_fingerprint)
  WHERE api_key_fingerprint IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_credentials_groq_slot
  ON public.ai_credentials(priority)
  WHERE LOWER(COALESCE(provider, '')) = 'groq';

ALTER TABLE public.ai_credentials ENABLE ROW LEVEL SECURITY;

-- Server uses the secret/service-role key, so it bypasses these browser-facing
-- RLS rules. Browser clients never receive encrypted credentials.
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

DROP POLICY IF EXISTS "Admin full access to ai_credentials" ON public.ai_credentials;
CREATE POLICY "Admin full access to ai_credentials" ON public.ai_credentials
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Replace every older 15-key trigger with the authoritative 20-slot rule.
CREATE OR REPLACE FUNCTION public.enforce_groq_credential_pool()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  slot_count INTEGER;
BEGIN
  IF LOWER(COALESCE(NEW.provider, '')) <> 'groq' THEN
    RAISE EXCEPTION 'Only Groq credentials are supported by the platform';
  END IF;

  IF NEW.priority IS NULL OR NEW.priority < 1 OR NEW.priority > 20 THEN
    RAISE EXCEPTION 'Groq API slot must be between 1 and 20';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO current_count
    FROM public.ai_credentials
    WHERE LOWER(COALESCE(provider, '')) = 'groq';

    IF current_count >= 20 THEN
      RAISE EXCEPTION 'The platform supports a maximum of 20 Groq API credentials';
    END IF;
  END IF;

  SELECT COUNT(*) INTO slot_count
  FROM public.ai_credentials
  WHERE LOWER(COALESCE(provider, '')) = 'groq'
    AND priority = NEW.priority
    AND id <> NEW.id;

  IF slot_count > 0 THEN
    RAISE EXCEPTION 'Groq API slot % is already allocated', NEW.priority;
  END IF;

  NEW.provider := 'groq';
  NEW.provider_label := 'Groq';
  NEW.model := 'platform-managed';
  NEW.base_url := 'https://api.groq.com/openai/v1';
  NEW.routing_group := CASE
    WHEN NEW.priority BETWEEN 1 AND 3 THEN 'architecture'
    WHEN NEW.priority BETWEEN 4 AND 6 THEN 'generation'
    WHEN NEW.priority BETWEEN 7 AND 9 THEN 'editing-repair'
    WHEN NEW.priority BETWEEN 10 AND 12 THEN 'testing'
    WHEN NEW.priority BETWEEN 13 AND 15 THEN 'security'
    WHEN NEW.priority BETWEEN 16 AND 18 THEN 'documentation-copilot'
    WHEN NEW.priority BETWEEN 19 AND 20 THEN 'research-compile'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_groq_credential_pool_trigger ON public.ai_credentials;
CREATE TRIGGER enforce_groq_credential_pool_trigger
  BEFORE INSERT OR UPDATE ON public.ai_credentials
  FOR EACH ROW EXECUTE FUNCTION public.enforce_groq_credential_pool();

COMMENT ON TABLE public.ai_credentials IS
  'Encrypted Groq API credentials. Twenty deterministic API slots are partitioned into dedicated workload groups; model selection is server-controlled.';
COMMENT ON COLUMN public.ai_credentials.priority IS
  'Immutable platform API slot identity 1-20. Administrators cannot select routing priority.';
COMMENT ON COLUMN public.ai_credentials.routing_group IS
  'Server-assigned workload group derived from the API slot.';
COMMENT ON COLUMN public.ai_credentials.model IS
  'Always platform-managed. The authoritative three-model task ladders live in server/config/aiPolicy.ts.';
