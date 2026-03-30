-- ============================================
-- ADD LANGUAGE COLUMN TO AGENTS TABLE
-- ============================================

-- Add language column to agents table
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'English';

-- Add check constraint for valid languages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agents_language_check' 
    AND conrelid = 'public.agents'::regclass
  ) THEN
    ALTER TABLE public.agents 
    ADD CONSTRAINT agents_language_check 
    CHECK (language IN ('English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Tagalog', 'Vietnamese', 'Russian', 'Polish'));
  END IF;
END $$;

-- Add index for language lookups
CREATE INDEX IF NOT EXISTS idx_agents_language ON public.agents(language);
