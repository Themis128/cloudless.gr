-- Database Overview and Health Check Script
-- Run this script to get a comprehensive overview of your Supabase database

-- ================================================================
-- DATABASE INFORMATION
-- ================================================================
SELECT 'DATABASE INFO' as section,
       current_database() as database_name,
       current_user as current_user,
       version() as postgresql_version;

-- ================================================================
-- SCHEMA INFORMATION
-- ================================================================
SELECT 'SCHEMAS' as section,
       schema_name,
       schema_owner
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY schema_name;

-- ================================================================
-- TABLE INFORMATION (PUBLIC SCHEMA)
-- ================================================================
SELECT 'PUBLIC TABLES' as section,
       table_name,
       table_type,
       pg_size_pretty(pg_total_relation_size('"'||table_schema||'"."'||table_name||'"')) as size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size('"'||table_schema||'"."'||table_name||'"') DESC;

-- ================================================================
-- TABLE ROW COUNTS (PUBLIC SCHEMA)
-- ================================================================
SELECT 'TABLE ROW COUNTS' as section,
       schemaname,
       tablename,
       n_live_tup as row_count,
       n_dead_tup as dead_rows,
       last_vacuum,
       last_autovacuum,
       last_analyze,
       last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ================================================================
-- AUTH SCHEMA INFORMATION
-- ================================================================
SELECT 'AUTH TABLES' as section,
       table_name,
       table_type
FROM information_schema.tables
WHERE table_schema = 'auth'
ORDER BY table_name;

-- ================================================================
-- AUTH USERS COUNT
-- ================================================================
SELECT 'AUTH USERS' as section,
       COUNT(*) as total_users,
       COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL) as confirmed_users,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent_users
FROM auth.users;

-- ================================================================
-- STORAGE INFORMATION
-- ================================================================
SELECT 'DATABASE SIZE' as section,
       pg_database.datname as database_name,
       pg_size_pretty(pg_database_size(pg_database.datname)) as size
FROM pg_database
WHERE datname = current_database();

-- ================================================================
-- RECENT ACTIVITY
-- ================================================================
SELECT 'RECENT ACTIVITY' as section,
       query_start,
       state,
       left(query, 100) as query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start DESC
LIMIT 10;
