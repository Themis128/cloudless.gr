-- Migration: Create contact_messages table
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now())
);

-- Enable RLS only if not already enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'contact_messages'
      AND c.relrowsecurity = false
  ) THEN
    EXECUTE 'ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;';
  END IF;
END
$$;

-- Create insert policy only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Allow insert for all'
      AND tablename = 'contact_messages'
  ) THEN
    EXECUTE '
      CREATE POLICY "Allow insert for all" ON public.contact_messages
      FOR INSERT WITH CHECK (true);
    ';
  END IF;
END
$$;
