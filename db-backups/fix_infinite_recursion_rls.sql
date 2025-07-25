-- Fix infinite recursion in RLS policies
-- Remove circular dependencies by simplifying policies

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow user to create own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow user to read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow user to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin to delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

-- Create simple, non-recursive policies
-- Allow users to create their own profile
CREATE POLICY "profiles_insert_policy" ON public.profiles
    FOR INSERT 
    WITH CHECK (id = auth.uid());

-- Allow users to read their own profile
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT 
    USING (id = auth.uid());

-- Allow users to update their own profile  
CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE 
    USING (id = auth.uid());

-- Allow users to delete their own profile
CREATE POLICY "profiles_delete_policy" ON public.profiles
    FOR DELETE 
    USING (id = auth.uid());

-- Create a separate service role policy for admin operations
-- This bypasses RLS when using service role key
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
