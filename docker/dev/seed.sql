-- Supabase Seeding File for User Management
-- This file is automatically run when Supabase starts up
-- Place this in: docker/dev/seed.sql (and reference it in docker-compose.dev.yml)

-- =============================================================================
-- PROFILES TABLE SETUP
-- =============================================================================

-- Drop existing profiles table if it exists (for reset scenarios)
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table with enhanced structure
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    website TEXT,
    bio TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (id),
    UNIQUE(username),
    UNIQUE(email),
    CONSTRAINT username_length CHECK (char_length(username) >= 3),
    CONSTRAINT role_valid CHECK (role IN ('user', 'admin', 'moderator'))
);

-- Add indexes for better performance
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_active ON public.profiles(is_active);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile (but not change role unless admin)
CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND (
            -- Regular users can't change their role
            (OLD.role = NEW.role) OR
            -- Only admins can change roles
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    );

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
    ON public.profiles FOR SELECT 
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- Allow admins to update all profiles
CREATE POLICY "Admins can update all profiles" 
    ON public.profiles FOR UPDATE 
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles" 
    ON public.profiles FOR DELETE 
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER trigger_new_user_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- SEED DATA - USERS AND ADMINS
-- =============================================================================

-- Note: In a real setup, users would be created via Supabase Auth API
-- This section shows the profile data that would be created

-- First, let's create some example auth users (this is normally done via API)
-- We'll use a function to simulate this for seeding purposes

-- Create a function to insert seed users (bypassing normal auth flow for seeding)
CREATE OR REPLACE FUNCTION seed_users()
RETURNS VOID AS $$
DECLARE
    themis_id UUID := 'abf0f77d-d299-4454-8e3a-0e4595b74e39';
    john_id UUID := gen_random_uuid();
    jane_id UUID := gen_random_uuid();
    bob_id UUID := gen_random_uuid();
    alice_id UUID := gen_random_uuid();
BEGIN
    -- Clear existing profiles first
    DELETE FROM public.profiles;
    
    -- Insert seed profiles directly (normally these would be created via the trigger)
    
    -- 1. Themistoklis Baltzakis - Main Admin
    INSERT INTO public.profiles (
        id, email, first_name, last_name, full_name, username, role, is_active, created_at, updated_at
    ) VALUES (
        themis_id,
        'baltzakis.themis@gmail.com',
        'Themistoklis',
        'Baltzakis', 
        'Themistoklis Baltzakis',
        'themis',
        'admin',
        true,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        full_name = EXCLUDED.full_name,
        username = EXCLUDED.username,
        role = EXCLUDED.role,
        updated_at = NOW();
    
    -- 2. John Doe - Admin
    INSERT INTO public.profiles (
        id, email, first_name, last_name, full_name, username, role, is_active, created_at, updated_at
    ) VALUES (
        john_id,
        'john.doe@example.com',
        'John',
        'Doe',
        'John Doe',
        'johndoe',
        'admin',
        true,
        NOW() - INTERVAL '7 days',
        NOW() - INTERVAL '7 days'
    );
    
    -- 3. Jane Smith - Moderator
    INSERT INTO public.profiles (
        id, email, first_name, last_name, full_name, username, role, is_active, created_at, updated_at
    ) VALUES (
        jane_id,
        'jane.smith@example.com',
        'Jane',
        'Smith',
        'Jane Smith',
        'janesmith',
        'moderator',
        true,
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days'
    );
    
    -- 4. Bob Wilson - Regular User
    INSERT INTO public.profiles (
        id, email, first_name, last_name, full_name, username, role, is_active, created_at, updated_at
    ) VALUES (
        bob_id,
        'bob.wilson@example.com',
        'Bob',
        'Wilson',
        'Bob Wilson',
        'bobwilson',
        'user',
        true,
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '3 days'
    );
    
    -- 5. Alice Johnson - Regular User
    INSERT INTO public.profiles (
        id, email, first_name, last_name, full_name, username, role, is_active, created_at, updated_at
    ) VALUES (
        alice_id,
        'alice.johnson@example.com',
        'Alice',
        'Johnson',
        'Alice Johnson',
        'alicejohnson',
        'user',
        true,
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
    );
    
    RAISE NOTICE 'Seed users created successfully!';
    RAISE NOTICE 'Admins: Themistoklis Baltzakis, John Doe';
    RAISE NOTICE 'Moderators: Jane Smith';
    RAISE NOTICE 'Users: Bob Wilson, Alice Johnson';
    
END;
$$ LANGUAGE plpgsql;

-- Run the seeding function
SELECT seed_users();

-- Clean up the seeding function (optional)
-- DROP FUNCTION seed_users();

-- =============================================================================
-- STORAGE BUCKETS SETUP
-- =============================================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true) 
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false) 
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
    ON storage.objects FOR INSERT 
    WITH CHECK (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own avatar" 
    ON storage.objects FOR UPDATE 
    WITH CHECK (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own avatar" 
    ON storage.objects FOR DELETE 
    USING (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage policies for documents (admin only)
CREATE POLICY "Only admins can access documents" 
    ON storage.objects FOR ALL 
    USING (
        bucket_id = 'documents' AND 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- =============================================================================
-- REALTIME SETUP
-- =============================================================================

-- Set up Realtime
BEGIN;
    DROP PUBLICATION IF EXISTS supabase_realtime;
    CREATE PUBLICATION supabase_realtime;
COMMIT;

-- Add profiles table to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Show all seeded users
SELECT 
    '=== SEEDED USERS ===' as info,
    email,
    full_name,
    username,
    role,
    is_active,
    created_at
FROM public.profiles 
ORDER BY 
    CASE role 
        WHEN 'admin' THEN 1 
        WHEN 'moderator' THEN 2 
        ELSE 3 
    END,
    created_at;

-- Show user counts by role
SELECT 
    '=== USER STATISTICS ===' as info,
    role,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM public.profiles 
GROUP BY role
ORDER BY 
    CASE role 
        WHEN 'admin' THEN 1 
        WHEN 'moderator' THEN 2 
        ELSE 3 
    END;

-- =============================================================================
-- NOTES
-- =============================================================================

/*
USAGE INSTRUCTIONS:

1. Place this file in: docker/dev/seed.sql

2. Update your docker/dev/docker-compose.dev.yml to include:
   volumes:
     - ./seed.sql:/docker-entrypoint-initdb.d/seed.sql

3. Or run manually after container startup:
   docker exec -i supabase_db_docker psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/seed.sql

SEEDED USERS:
- baltzakis.themis@gmail.com (admin) - Your main account
- john.doe@example.com (admin) - Test admin
- jane.smith@example.com (moderator) - Test moderator  
- bob.wilson@example.com (user) - Test user
- alice.johnson@example.com (user) - Test user

Note: The actual auth.users entries need to be created via Supabase Auth API.
This script only creates the profile entries.
*/
