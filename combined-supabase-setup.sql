-- Combined Supabase Schema Setup
-- Copy and paste this entire file into your Supabase SQL Editor
-- This will create all necessary tables and policies for your Nuxt app

-- =============================================================================
-- CONTACT SUBMISSIONS TABLE
-- =============================================================================

-- Create contact_submissions table
CREATE TABLE IF NOT EXISTS contact_submissions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'replied', 'archived')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_contact_submissions_updated_at 
    BEFORE UPDATE ON contact_submissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can insert contact submissions" ON contact_submissions;
DROP POLICY IF EXISTS "Admins can read all contact submissions" ON contact_submissions;
DROP POLICY IF EXISTS "Admins can update contact submissions" ON contact_submissions;
DROP POLICY IF EXISTS "Admins can delete contact submissions" ON contact_submissions;

-- Create policies for contact submissions
CREATE POLICY "Anyone can insert contact submissions" ON contact_submissions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read contact submissions" ON contact_submissions
    FOR SELECT USING (true);

CREATE POLICY "Anyone can update contact submissions" ON contact_submissions
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete contact submissions" ON contact_submissions
    FOR DELETE USING (true);

-- Insert sample data for testing
INSERT INTO contact_submissions (name, email, subject, message, metadata) VALUES
    ('John Doe', 'john@example.com', 'Test Subject', 'This is a test message.', '{"ip": "127.0.0.1", "userAgent": "Mozilla/5.0", "submissionTime": "2025-05-31T12:00:00Z"}'),
    ('Jane Smith', 'jane@example.com', 'Another Test', 'Another test message.', '{"ip": "192.168.1.1", "userAgent": "Chrome", "submissionTime": "2025-05-31T13:00:00Z"}')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- INSTRUMENTS TABLE
-- =============================================================================

-- Create the instruments table
CREATE TABLE IF NOT EXISTS instruments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample instruments data
INSERT INTO instruments (name)
VALUES ('violin'), ('viola'), ('cello'), ('piano'), ('guitar'), ('flute')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "public can read instruments" ON instruments;
DROP POLICY IF EXISTS "authenticated users can insert instruments" ON instruments;
DROP POLICY IF EXISTS "authenticated users can update instruments" ON instruments;
DROP POLICY IF EXISTS "authenticated users can delete instruments" ON instruments;

-- Create policies that allow public access for testing
CREATE POLICY "public can read instruments"
ON instruments
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "public can insert instruments"
ON instruments
FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "public can update instruments"
ON instruments
FOR UPDATE TO anon, authenticated
USING (true);

CREATE POLICY "public can delete instruments"
ON instruments
FOR DELETE TO anon, authenticated
USING (true);

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check that tables were created successfully
SELECT 'contact_submissions' as table_name, count(*) as row_count FROM contact_submissions
UNION ALL
SELECT 'instruments' as table_name, count(*) as row_count FROM instruments;

-- Show table policies for verification
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('contact_submissions', 'instruments')
ORDER BY tablename, policyname;
