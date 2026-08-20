-- AI Contracts: authoritative Supabase persistence hardening
-- Apply this migration after the existing 20260818000000/001 migrations.

-- 1. AI credentials now carry the exact provider/model/endpoint configured by Admin.
ALTER TABLE public.ai_credentials
  ADD COLUMN IF NOT EXISTS provider_label TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS base_url TEXT;

UPDATE public.ai_credentials
SET
  provider_label = COALESCE(provider_label, CASE provider
    WHEN 'groq' THEN 'Groq'
    WHEN 'openai' THEN 'OpenAI'
    WHEN 'gemini' THEN 'Google Gemini'
    WHEN 'anthropic' THEN 'Anthropic'
    ELSE provider
  END),
  model = COALESCE(NULLIF(model, ''), 'openai/gpt-oss-120b'),
  base_url = COALESCE(NULLIF(base_url, ''), CASE provider
    WHEN 'groq' THEN 'https://api.groq.com/openai/v1'
    WHEN 'openai' THEN 'https://api.openai.com/v1'
    WHEN 'openrouter' THEN 'https://openrouter.ai/api/v1'
    WHEN 'together' THEN 'https://api.together.xyz/v1'
    WHEN 'fireworks' THEN 'https://api.fireworks.ai/inference/v1'
    WHEN 'deepseek' THEN 'https://api.deepseek.com'
    WHEN 'xai' THEN 'https://api.x.ai/v1'
    WHEN 'mistral' THEN 'https://api.mistral.ai/v1'
    WHEN 'cerebras' THEN 'https://api.cerebras.ai/v1'
    WHEN 'sambanova' THEN 'https://api.sambanova.ai/v1'
    WHEN 'perplexity' THEN 'https://api.perplexity.ai'
    WHEN 'moonshot' THEN 'https://api.moonshot.ai/v1'
    WHEN 'qwen' THEN 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    WHEN 'nvidia' THEN 'https://integrate.api.nvidia.com/v1'
    WHEN 'gemini' THEN 'https://generativelanguage.googleapis.com'
    WHEN 'anthropic' THEN 'https://api.anthropic.com'
    ELSE ''
  END);

ALTER TABLE public.ai_credentials
  ALTER COLUMN model SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_credentials_provider_enabled_priority
  ON public.ai_credentials(provider, enabled, priority);

-- 2. Stronger project lookup indexes for user isolation and admin inventory.
CREATE INDEX IF NOT EXISTS idx_projects_user_created
  ON public.projects(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_created
  ON public.projects(created_at DESC);

-- 3. Ensure project mutations are owner-only while admins can read the inventory.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;

CREATE POLICY "Users can manage own projects" ON public.projects
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all projects" ON public.projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true
    )
  );

-- 4. Admin-managed AI credentials remain server/service-role only.
ALTER TABLE public.ai_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to ai_credentials" ON public.ai_credentials;
CREATE POLICY "Admin full access to ai_credentials" ON public.ai_credentials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true
    )
  );

-- 5. Keep profile records synchronized with Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at, last_login)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN LOWER(NEW.email) = 'sarveshtiwarisarvesh@gmail.com' THEN 'admin' ELSE 'user' END,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: Do not store raw provider API keys in any table. encrypted_api_key is
-- written only by the server after AES-256-GCM encryption.

-- 6. Avoid recursive RLS evaluation when an admin reads profiles/projects.
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

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;
CREATE POLICY "Admins can view all projects" ON public.projects
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admin full access to ai_credentials" ON public.ai_credentials;
CREATE POLICY "Admin full access to ai_credentials" ON public.ai_credentials
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. Prevent a browser session from self-promoting to administrator or
-- re-enabling a disabled account. Server/service-role operations may still
-- change these fields because auth.uid() is NULL for service-role requests.
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Protected profile fields can only be changed by the platform administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_security_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_security_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_security_fields();
