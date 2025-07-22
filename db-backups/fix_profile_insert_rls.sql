-- Fix profile INSERT policy to allow new user registration
-- This resolves the circular dependency issue where new users can't create profiles

-- Drop existing problematic INSERT policy
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

-- Create a new INSERT policy that allows users to create their own profile
-- This policy allows auth.uid() to insert a record with id = auth.uid()
CREATE POLICY "Allow user to create own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Also ensure we have the basic SELECT and UPDATE policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "Allow user to read own profile"
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "Allow user to update own profile"
  ON public.profiles
  FOR UPDATE
  USING (
    id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add a DELETE policy for completeness (admin only)
CREATE POLICY "Allow admin to delete profiles"
  ON public.profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
