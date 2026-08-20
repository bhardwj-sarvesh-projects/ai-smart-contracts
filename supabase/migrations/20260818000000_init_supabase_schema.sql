-- Supabase PostgreSQL Initial Migration Schema for AI Contracts Platform
-- Authoritative database schema replacing legacy Firebase/Firestore storage

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Profiles Table linked to Supabase Auth (auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  security_question TEXT,
  security_answer_hash TEXT,
  photo_url TEXT DEFAULT '',
  preferences JSONB DEFAULT '{}'::jsonb,
  ai_settings JSONB DEFAULT '{}'::jsonb,
  last_login TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Enable Row Level Security (RLS) on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all profiles') THEN
    CREATE POLICY "Admins can view all profiles" ON public.profiles
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;


-- 2. Create ai_credentials Table for Platform AI Infrastructure Keys
CREATE TABLE IF NOT EXISTS public.ai_credentials (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'groq',
  display_name TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
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

-- Index for ordering enabled credentials by priority
CREATE INDEX IF NOT EXISTS idx_ai_credentials_enabled_priority
  ON public.ai_credentials(enabled, priority);

-- Enable Row Level Security (RLS) on ai_credentials
ALTER TABLE public.ai_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins or service role can manage ai_credentials
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access to ai_credentials') THEN
    CREATE POLICY "Admin full access to ai_credentials" ON public.ai_credentials
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;


-- 3. Automatic Profile Creation Trigger on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    last_login
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN LOWER(NEW.email) = 'sarveshtiwarisarvesh@gmail.com' THEN 'admin' ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'user') END,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    last_login = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
