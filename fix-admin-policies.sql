-- Fix all problematic RLS policies on profiles table
-- Remove circular references that cause infinite recursion

-- Drop the problematic admin policies
DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create simpler admin policies that don't cause recursion
-- For now, we'll disable admin-specific policies and rely on application logic
-- This is safer for development

-- Users can view their own profile
-- (This policy already exists and is fine)

-- Users can update their own profile
-- (This policy was already fixed)

-- Note: Admin functionality should be handled at the application level
-- or with a separate admin role/table to avoid recursion
