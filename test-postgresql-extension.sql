-- PostgreSQL Extension Test Queries
-- Use these queries to test your VS Code PostgreSQL extension configuration

-- =================================
-- BASIC CONNECTION TEST
-- =================================
-- Test basic connection and get PostgreSQL version
SELECT version() as postgresql_version;

-- Get current database and user info
SELECT
    current_database() as database_name,
    current_user as username,
    session_user as session_user,
    now() as current_timestamp;

-- =================================
-- SUPABASE SPECIFIC TESTS
-- =================================
-- Check if auth schema exists (Supabase specific)
SELECT EXISTS (
    SELECT 1 FROM information_schema.schemata
    WHERE schema_name = 'auth'
) as auth_schema_exists;

-- List all schemas in the database
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY schema_name;

-- =================================
-- DATABASE HEALTH CHECK
-- =================================
-- Check database size
SELECT
    pg_database.datname as database_name,
    pg_size_pretty(pg_database_size(pg_database.datname)) as size
FROM pg_database
WHERE datname = current_database();

-- List all tables with row counts (public schema)
SELECT
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- =================================
-- AUTHENTICATION TEST (SUPABASE)
-- =================================
-- Count users in auth.users (if exists)
-- Note: This will only work if you have auth schema and permissions
SELECT
    COUNT(*) as total_users,
    COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmed_users,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_users
FROM auth.users;

-- List recent user registrations
SELECT
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- =================================
-- PERFORMANCE MONITORING
-- =================================
-- Check active connections
SELECT
    datname as database,
    count(*) as connections,
    max(backend_start) as oldest_connection
FROM pg_stat_activity
WHERE state = 'active'
GROUP BY datname;

-- Get slow queries (if any)
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 5;

-- =================================
-- TABLE INSPECTION
-- =================================
-- List all tables with their sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as bytes
FROM pg_tables
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check for unused indexes
SELECT
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelname::regclass)) as size
FROM pg_stat_user_indexes
WHERE idx_tup_read = 0 AND idx_tup_fetch = 0
ORDER BY pg_relation_size(indexrelname::regclass) DESC;

-- =================================
-- EXTENSIONS AND FEATURES
-- =================================
-- List installed PostgreSQL extensions
SELECT
    name,
    default_version,
    installed_version,
    comment
FROM pg_available_extensions
WHERE installed_version IS NOT NULL
ORDER BY name;

-- Check PostgreSQL configuration
SELECT
    name,
    setting,
    unit,
    context,
    short_desc
FROM pg_settings
WHERE name IN (
    'max_connections',
    'shared_buffers',
    'effective_cache_size',
    'work_mem',
    'maintenance_work_mem'
)
ORDER BY name;
