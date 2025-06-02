-- Create the instruments table if it doesn't exist
CREATE TABLE IF NOT EXISTS instruments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some sample data, skipping if already inserted
INSERT INTO instruments (name)
VALUES ('violin'), ('viola'), ('cello'), ('piano'), ('guitar'), ('flute')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist to avoid conflicts
DROP POLICY IF EXISTS "public can read instruments" ON instruments;
DROP POLICY IF EXISTS "authenticated users can insert instruments" ON instruments;
DROP POLICY IF EXISTS "authenticated users can update instruments" ON instruments;
DROP POLICY IF EXISTS "authenticated users can delete instruments" ON instruments;

-- Create a policy that allows public (anon) read access
CREATE POLICY "public can read instruments"
ON instruments
FOR SELECT TO anon
USING (true);

-- Allow authenticated users to insert instruments
CREATE POLICY "authenticated users can insert instruments"
ON instruments
FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update instruments (add ownership checks if needed)
CREATE POLICY "authenticated users can update instruments"
ON instruments
FOR UPDATE TO authenticated
USING (true);

-- Allow authenticated users to delete instruments (add ownership checks if needed)
CREATE POLICY "authenticated users can delete instruments"
ON instruments
FOR DELETE TO authenticated
USING (true);
