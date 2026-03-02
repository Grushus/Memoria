-- Memoria Database Schema
-- Run this in the Supabase SQL editor to set up the database
-- NOTE: Also run the trigger in supabase/trigger_new_user.sql

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text,
  total_catches int NOT NULL DEFAULT 0,
  first_discovery_count int NOT NULL DEFAULT 0,
  countries_visited text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  subcategory text NOT NULL,
  description text,
  fun_fact text,
  is_endangered boolean DEFAULT false,
  rarity_tier text NOT NULL DEFAULT 'legendary',
  first_discoverer_id uuid REFERENCES public.users(id),
  total_catches int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index for fast duplicate-check by name
CREATE INDEX IF NOT EXISTS entries_name_lower_idx ON public.entries (lower(name));

CREATE TABLE IF NOT EXISTS public.user_catches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES public.entries(id),
  catch_type text NOT NULL CHECK (catch_type IN ('identified', 'gallery')),
  category text NOT NULL,
  subcategory text NOT NULL,
  photo_url text NOT NULL,
  lat float,
  lng float,
  country text,
  entry_number int,
  discovery_badge text CHECK (discovery_badge IN ('first_discoverer', 'first_10', 'first_100', 'first_1000')),
  user_note text,
  timestamp timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_catches_user_id_idx ON public.user_catches (user_id);
CREATE INDEX IF NOT EXISTS user_catches_entry_id_idx ON public.user_catches (entry_id);

-- ============================================================
-- STORAGE
-- ============================================================

-- Create storage bucket for catch photos (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('catches', 'catches', true);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_catches ENABLE ROW LEVEL SECURITY;

-- Users: read own row, insert own row, update own row
CREATE POLICY "Users can read their own profile"
  ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE USING (auth.uid() = id);

-- Entries: anyone authenticated can read, anyone can insert
CREATE POLICY "Authenticated users can read entries"
  ON public.entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert entries"
  ON public.entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update entries"
  ON public.entries FOR UPDATE TO authenticated USING (true);

-- User catches: read own, insert own
CREATE POLICY "Users can read their own catches"
  ON public.user_catches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own catches"
  ON public.user_catches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own catches"
  ON public.user_catches FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS (RPCs called from the app)
-- ============================================================

-- Atomically increment total_catches on an entry, return new total
CREATE OR REPLACE FUNCTION increment_catches(entry_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_total int;
BEGIN
  UPDATE public.entries
  SET total_catches = total_catches + 1
  WHERE id = entry_id
  RETURNING total_catches INTO new_total;
  RETURN new_total;
END;
$$;

-- Increment user total_catches
CREATE OR REPLACE FUNCTION increment_user_catches(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users
  SET total_catches = total_catches + 1
  WHERE id = target_user_id;
END;
$$;

-- Add a country to user's countries_visited array (no duplicates)
CREATE OR REPLACE FUNCTION add_country_visited(target_user_id uuid, country_code text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users
  SET countries_visited = array_append(countries_visited, country_code)
  WHERE id = target_user_id
    AND NOT (country_code = ANY(countries_visited));
END;
$$;

-- ============================================================
-- STORAGE POLICY (run after creating bucket)
-- ============================================================

-- Allow authenticated users to upload to catches bucket
-- CREATE POLICY "Authenticated users can upload photos"
--   ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'catches');

-- Allow public read access to catch photos
-- CREATE POLICY "Public read access for catch photos"
--   ON storage.objects FOR SELECT USING (bucket_id = 'catches');
