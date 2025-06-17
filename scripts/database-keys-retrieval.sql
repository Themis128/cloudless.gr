-- SQL Script to Retrieve All Needed Keys and Information
-- Run this in your Supabase SQL Editor or PostgreSQL client

-- ==========================================
-- 1. RETRIEVE JWT SECRETS AND CONFIGURATION
-- ==========================================

-- Get JWT Secret from auth.config (if available)
SELECT 
    'JWT_SECRET' as key_type,
    jwt_secret as secret_value,
    'Use this for JWT_SECRET in .env' as description
FROM auth.config 
WHERE id = 1;

-- Get API URL and other settings
SELECT 
    'API_URL' as key_type,
    api_url as secret_value,
    'Your Supabase API URL' as description
FROM auth.config 
WHERE id = 1;

-- ==========================================
-- 2. RETRIEVE USER AUTHENTICATION INFO
-- ==========================================

-- Get all users from auth.users
SELECT 
    'USER_INFO' as type,
    id as user_id,
    email,
    created_at,
    email_confirmed_at,
    raw_user_meta_data,
    'All users in auth system' as description
FROM auth.users
ORDER BY created_at DESC;

-- ==========================================
-- 3. RETRIEVE PROFILES INFORMATION
-- ==========================================

-- Check if profiles table exists and get structure
SELECT 
    'PROFILES_STRUCTURE' as type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    'Profiles table structure' as description
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Get all profiles data (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        RAISE NOTICE 'Profiles table exists, retrieving data...';
        -- This will only work if the table exists
    ELSE
        RAISE NOTICE 'Profiles table does not exist yet';
    END IF;
END $$;

-- Safely get profiles data
SELECT 
    'PROFILES_DATA' as type,
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.full_name,
    p.role,
    p.created_at,
    'All profile records' as description
FROM public.profiles p
ORDER BY p.created_at DESC;

-- ==========================================
-- 4. RETRIEVE ADMIN USERS SPECIFICALLY
-- ==========================================

-- Get admin users (combining auth and profiles)
SELECT 
    'ADMIN_USERS' as type,
    u.id as user_id,
    u.email as auth_email,
    p.email as profile_email,
    p.first_name,
    p.last_name,
    p.role,
    u.created_at,
    'Users with admin role' as description
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.role = 'admin' OR u.email = 'baltzakis.themis@gmail.com'
ORDER BY u.created_at DESC;

-- ==========================================
-- 5. RETRIEVE SERVICE ROLE AND API KEYS INFO
-- ==========================================

-- Get service role information
SELECT 
    'SERVICE_ROLES' as type,
    rolname as role_name,
    rolsuper as is_superuser,
    rolcreaterole as can_create_roles,
    rolcreatedb as can_create_db,
    'Database roles information' as description
FROM pg_roles 
WHERE rolname LIKE '%service%' OR rolname LIKE '%anon%' OR rolname LIKE '%authenticated%'
ORDER BY rolname;

-- ==========================================
-- 6. CHECK TABLE PERMISSIONS
-- ==========================================

-- Check permissions on profiles table
SELECT 
    'TABLE_PERMISSIONS' as type,
    grantee,
    privilege_type,
    is_grantable,
    'Permissions on profiles table' as description
FROM information_schema.role_table_grants 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
ORDER BY grantee, privilege_type;

-- ==========================================
-- 7. GET DATABASE CONNECTION INFO
-- ==========================================

-- Get current database and connection info
SELECT 
    'CONNECTION_INFO' as type,
    current_database() as database_name,
    current_user as current_user,
    session_user as session_user,
    inet_server_addr() as server_address,
    inet_server_port() as server_port,
    'Current connection details' as description;

-- ==========================================
-- 8. RETRIEVE RLS (Row Level Security) POLICIES
-- ==========================================

-- Get RLS policies for profiles table
SELECT 
    'RLS_POLICIES' as type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    'Row Level Security policies' as description
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY schemaname, tablename, policyname;

-- ==========================================
-- 9. UTILITY QUERIES FOR TROUBLESHOOTING
-- ==========================================

-- Check if specific user exists
SELECT 
    'USER_CHECK' as type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'baltzakis.themis@gmail.com') 
        THEN 'User exists in auth.users'
        ELSE 'User does NOT exist in auth.users'
    END as user_status,
    'Check if your email exists' as description;

-- Check if user has profile
SELECT 
    'PROFILE_CHECK' as type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.profiles WHERE email = 'baltzakis.themis@gmail.com') 
        THEN 'Profile exists in profiles table'
        ELSE 'Profile does NOT exist in profiles table'
    END as profile_status,
    'Check if your profile exists' as description;

-- ==========================================
-- FINAL SUMMARY
-- ==========================================

SELECT 
    'SUMMARY' as type,
    'Database analysis complete' as message,
    'Review all results above for your needed keys and configuration' as description;
