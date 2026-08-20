-- Supabase Application Data Schema Migration
-- Defines projects, user settings, deployments, audits, templates, and analytics tables

-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  blockchain TEXT NOT NULL DEFAULT 'ethereum',
  language TEXT NOT NULL DEFAULT 'solidity',
  framework TEXT NOT NULL DEFAULT 'foundry',
  contract_type TEXT DEFAULT 'Smart Contract',
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_file_path TEXT,
  audit JSONB,
  versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  deployments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user project queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Projects
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own projects') THEN
    CREATE POLICY "Users can manage own projects" ON public.projects
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all projects') THEN
    CREATE POLICY "Admins can view all projects" ON public.projects
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;


-- 2. Create User Settings Table
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'groq',
  api_key TEXT DEFAULT '',
  default_model TEXT DEFAULT 'platform-router',
  temperature NUMERIC DEFAULT 0.1,
  max_tokens INTEGER DEFAULT 65536,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own settings') THEN
    CREATE POLICY "Users can manage own settings" ON public.user_settings
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;


-- 3. Create Audit Records Table
CREATE TABLE IF NOT EXISTS public.audit_records (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  summary TEXT,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_records_user ON public.audit_records(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_records_project ON public.audit_records(project_id);

ALTER TABLE public.audit_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own audit records') THEN
    CREATE POLICY "Users can view own audit records" ON public.audit_records
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;


-- 4. Create Deployments Table
CREATE TABLE IF NOT EXISTS public.deployments (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network TEXT NOT NULL,
  contract_name TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  transaction_hash TEXT,
  gas_used TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  logs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployments_user ON public.deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project ON public.deployments(project_id);

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own deployments') THEN
    CREATE POLICY "Users can view own deployments" ON public.deployments
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;


-- 5. Create Contract Templates Table
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  blockchain TEXT NOT NULL DEFAULT 'ethereum',
  language TEXT NOT NULL DEFAULT 'solidity',
  framework TEXT NOT NULL DEFAULT 'foundry',
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view templates') THEN
    CREATE POLICY "Authenticated users can view templates" ON public.contract_templates
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;


-- 6. Create Analytics Events Table
CREATE TABLE IF NOT EXISTS public.analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON public.analytics(event_type);

ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own analytics') THEN
    CREATE POLICY "Users can insert own analytics" ON public.analytics
      FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;
