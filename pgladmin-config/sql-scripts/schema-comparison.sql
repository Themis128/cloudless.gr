-- Schema Comparison Script
-- Compare schemas between cloud and local databases

-- ================================================================
-- TABLES COMPARISON
-- ================================================================

-- Tables in public schema with column counts
SELECT
    'TABLE_STRUCTURE' as comparison_type,
    t.table_name,
    COUNT(c.column_name) as column_count,
    string_agg(c.column_name || ':' || c.data_type, ', ' ORDER BY c.ordinal_position) as columns
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;

-- ================================================================
-- COLUMN DIFFERENCES FOR SPECIFIC TABLES
-- ================================================================

-- Profiles table structure
SELECT
    'PROFILES_COLUMNS' as section,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Userinfo table structure
SELECT
    'USERINFO_COLUMNS' as section,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'userinfo'
ORDER BY ordinal_position;

-- ================================================================
-- CONSTRAINTS AND INDEXES
-- ================================================================

-- Primary keys
SELECT
    'PRIMARY_KEYS' as section,
    tc.table_name,
    tc.constraint_name,
    string_agg(kcu.column_name, ', ') as key_columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'PRIMARY KEY'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- Foreign keys
SELECT
    'FOREIGN_KEYS' as section,
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;

-- Indexes
SELECT
    'INDEXES' as section,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
