-- AI Contracts: 20-key dedicated Groq routing architecture v2
-- Apply AFTER 20260819000001_groq_key_pool_and_routing.sql.
-- Safe to run more than once.
--
-- Architecture:
--   API 01-03  -> Architecture / Repository Analysis
--   API 04-06  -> Smart Contract Generation
--   API 07-09  -> Editing / Repair
--   API 10-12  -> Testing / Test Analysis
--   API 13-15  -> Security / Security Remediation
--   API 16-18  -> Documentation / Copilot
--   API 19-20  -> Research (two-key group)
--
-- Model selection is NOT stored as administrator configuration. The server's
-- locked routing policy determines the three-model ladder for each group.

ALTER TABLE public.ai_credentials
  ADD COLUMN IF NOT EXISTS routing_group TEXT;

-- Normalize legacy rows into deterministic API slots before adding the unique
-- slot constraint. Existing priority order is preserved by created_at.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY priority ASC, created_at ASC, id ASC) AS new_slot
  FROM public.ai_credentials
  WHERE LOWER(COALESCE(provider, '')) = 'groq'
)
UPDATE public.ai_credentials c
SET priority = ranked.new_slot::INTEGER
FROM ranked
WHERE c.id = ranked.id;

UPDATE public.ai_credentials
SET routing_group = CASE
  WHEN priority BETWEEN 1 AND 3 THEN 'architecture'
  WHEN priority BETWEEN 4 AND 6 THEN 'generation'
  WHEN priority BETWEEN 7 AND 9 THEN 'editing-repair'
  WHEN priority BETWEEN 10 AND 12 THEN 'testing'
  WHEN priority BETWEEN 13 AND 15 THEN 'security'
  WHEN priority BETWEEN 16 AND 18 THEN 'documentation-copilot'
  WHEN priority BETWEEN 19 AND 20 THEN 'research-compile'
  ELSE 'architecture'
END
WHERE LOWER(COALESCE(provider, '')) = 'groq';

ALTER TABLE public.ai_credentials
  ALTER COLUMN routing_group SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_credentials_groq_slot
  ON public.ai_credentials(priority)
  WHERE LOWER(COALESCE(provider, '')) = 'groq';

CREATE INDEX IF NOT EXISTS idx_ai_credentials_routing_group
  ON public.ai_credentials(provider, routing_group, enabled, priority);

-- Replace the old 15-key trigger with a 20-key slot-enforcing trigger.
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
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_groq_credential_pool();

COMMENT ON COLUMN public.ai_credentials.priority IS
  'Immutable platform API slot identity 1-20. Administrators cannot select routing priority.';
COMMENT ON COLUMN public.ai_credentials.routing_group IS
  'Server-assigned dedicated workload group derived from the API slot; administrators cannot change it.';
COMMENT ON COLUMN public.ai_credentials.model IS
  'Always platform-managed. Each routing group has a locked three-model ladder in server/config/aiPolicy.ts.';
COMMENT ON TABLE public.ai_credentials IS
  'Encrypted Groq API credentials. Twenty deterministic API slots are partitioned into dedicated workload groups; model selection is server-controlled.';
