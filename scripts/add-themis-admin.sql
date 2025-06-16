-- SQL Script to add Themistoklis Baltzakis as Admin User
-- Run this directly in the database or via Docker

-- First, let's check if the user already exists
SELECT 'Checking existing user...' as status, id, email, created_at 
FROM auth.users 
WHERE email = 'baltzakis.themis@gmail.com';

-- If user doesn't exist, you'll need to create them via the Auth API first
-- This SQL script assumes the user already exists in auth.users

-- Create/Update profile with admin role
INSERT INTO public.profiles (
    id, 
    email, 
    first_name, 
    last_name, 
    full_name, 
    role, 
    created_at, 
    updated_at
)
SELECT 
    u.id,
    'baltzakis.themis@gmail.com',
    'Themistoklis',
    'Baltzakis',
    'Themistoklis Baltzakis',
    'admin',
    NOW(),
    NOW()
FROM auth.users u 
WHERE u.email = 'baltzakis.themis@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    full_name = EXCLUDED.full_name,
    role = 'admin',
    updated_at = NOW();

-- Verify the admin setup
SELECT 'Admin verification:' as status, 
       p.id, 
       p.email, 
       p.full_name, 
       p.role, 
       p.created_at,
       u.created_at as auth_created
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.email = 'baltzakis.themis@gmail.com';

-- Show all admins
SELECT 'All admins:' as status,
       p.email,
       p.full_name,
       p.role,
       p.created_at
FROM public.profiles p
WHERE p.role = 'admin'
ORDER BY p.created_at;
