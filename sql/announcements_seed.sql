-- Announcements table for system-wide announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS announcements_select_all ON public.announcements;
DROP POLICY IF EXISTS announcements_insert_authenticated ON public.announcements;
DROP POLICY IF EXISTS announcements_update_authenticated ON public.announcements;
DROP POLICY IF EXISTS announcements_delete_authenticated ON public.announcements;

-- Create policies for authenticated users
CREATE POLICY announcements_select_all
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY announcements_insert_authenticated
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY announcements_update_authenticated
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY announcements_delete_authenticated
  ON public.announcements
  FOR DELETE
  TO authenticated
  USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;