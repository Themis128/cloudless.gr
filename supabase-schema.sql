-- Supabase schema for Cloudless.gr contact submissions
-- Run this in your Supabase SQL editor to create the required tables

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

-- Create an index on email for faster queries
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);

-- Create an index on status for filtering
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions(status);

-- Create an index on created_at for ordering
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

-- Enable Row Level Security (RLS)
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (adjust as needed for your security requirements)
-- This allows anyone to insert contact submissions (for the contact form)
CREATE POLICY "Anyone can insert contact submissions" ON contact_submissions
    FOR INSERT WITH CHECK (true);

-- Create policy for admin access (you'll need to implement authentication)
-- This allows authenticated admin users to read all submissions
CREATE POLICY "Admins can read all contact submissions" ON contact_submissions
    FOR SELECT USING (
        -- Replace with your admin authentication logic
        -- For example: auth.jwt() ->> 'role' = 'admin'
        true  -- Temporarily allow all reads - update this for production!
    );

-- Create policy for admin updates
CREATE POLICY "Admins can update contact submissions" ON contact_submissions
    FOR UPDATE USING (
        -- Replace with your admin authentication logic
        true  -- Temporarily allow all updates - update this for production!
    );

-- Create policy for admin deletes
CREATE POLICY "Admins can delete contact submissions" ON contact_submissions
    FOR DELETE USING (
        -- Replace with your admin authentication logic
        true  -- Temporarily allow all deletes - update this for production!
    );

-- Insert some sample data (optional, for testing)
INSERT INTO contact_submissions (name, email, subject, message, metadata) VALUES
    ('John Doe', 'john@example.com', 'Test Subject', 'This is a test message.', '{"ip": "127.0.0.1", "userAgent": "Mozilla/5.0", "submissionTime": "2025-05-31T12:00:00Z"}'),
    ('Jane Smith', 'jane@example.com', 'Another Test', 'Another test message.', '{"ip": "192.168.1.1", "userAgent": "Chrome", "submissionTime": "2025-05-31T13:00:00Z"}');
