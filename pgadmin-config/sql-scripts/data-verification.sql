-- Data Sync Verification Script
-- Check data consistency between cloud and local

-- ================================================================
-- TABLE ROW COUNTS
-- ================================================================
SELECT
    'ROW_COUNTS' as section,
    'profiles' as table_name,
    COUNT(*) as row_count
FROM profiles
UNION ALL
SELECT
    'ROW_COUNTS' as section,
    'userinfo' as table_name,
    COUNT(*) as row_count
FROM userinfo
UNION ALL
SELECT
    'ROW_COUNTS' as section,
    'auth.users' as table_name,
    COUNT(*) as row_count
FROM auth.users
UNION ALL
SELECT
    'ROW_COUNTS' as section,
    'auth.identities' as table_name,
    COUNT(*) as row_count
FROM auth.identities;

-- ================================================================
-- SAMPLE DATA FROM KEY TABLES
-- ================================================================

-- Profiles sample
SELECT 'PROFILES_SAMPLE' as section, * FROM profiles LIMIT 5;

-- Userinfo sample
SELECT 'USERINFO_SAMPLE' as section, * FROM userinfo LIMIT 5;

-- Auth users sample (safe columns only)
SELECT
    'AUTH_USERS_SAMPLE' as section,
    id,
    email,
    created_at,
    updated_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users
LIMIT 5;

-- ================================================================
-- DATA QUALITY CHECKS
-- ================================================================

-- Check for NULL emails in profiles
SELECT
    'DATA_QUALITY' as section,
    'profiles_null_emails' as check_name,
    COUNT(*) as count
FROM profiles
WHERE email IS NULL;

-- Check for duplicate emails in profiles
SELECT
    'DATA_QUALITY' as section,
    'profiles_duplicate_emails' as check_name,
    COUNT(*) as count
FROM (
    SELECT email
    FROM profiles
    WHERE email IS NOT NULL
    GROUP BY email
    HAVING COUNT(*) > 1
) duplicates;

-- Check auth users without profiles
SELECT
    'DATA_QUALITY' as section,
    'auth_users_without_profiles' as check_name,
    COUNT(*) as count
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;
