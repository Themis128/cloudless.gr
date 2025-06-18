-- Fix the problematic RLS policy on profiles table
-- This removes the circular reference that causes infinite recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create a simpler policy without circular reference
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE
TO public
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
