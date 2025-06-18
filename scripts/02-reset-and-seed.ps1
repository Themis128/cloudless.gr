# Complete Supabase Reset and Seeding Script - Optimized Version
# This script completely resets Supabase and gets it running immediately
# Combines features from all reset scripts for comprehensive environment setup
#
# Features:
#   • Complete Docker environment reset
#   • Environment validation and fixes
#   • Line ending corrections for cross-platform compatibility
#   • Automatic database seeding
#   • Multiple execution modes for different scenarios
#
# Usage Examples:
#   .\scripts\02-reset-and-seed.ps1                    # Full reset with seeding and pgAdmin
#   .\scripts\02-reset-and-seed.ps1 -SkipSeed         # Reset without seeding
#   .\scripts\02-reset-and-seed.ps1 -SkipPgAdmin      # Reset without pgAdmin setup
#   .\scripts\02-reset-and-seed.ps1 -DevMode          # Development mode
#   .\scripts\02-reset-and-seed.ps1 -Quick            # Super quick mode (minimal cleanup)
#   .\scripts\02-reset-and-seed.ps1 -Force            # Skip all prompts
#   .\scripts\02-reset-and-seed.ps1 -FixLineEndings   # Fix line endings only
#   .\scripts\02-reset-and-seed.ps1 -ValidateOnly     # Validate environment only

param(
    [switch]$SkipSeed,
    [switch]$DevMode,
    [switch]$Quick,
    [switch]$Force,
    [switch]$NoCleanup,
    [switch]$FixLineEndings,
    [switch]$ValidateOnly,
    [switch]$SkipPgAdmin
)

# Function to fix line endings - prevents parsing errors
function Repair-AllLineEndings {
    param([string]$BaseDirectory = ".")

    Write-Host ""
    Write-Host "🔧 COMPREHENSIVE LINE ENDING FIXES..." -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

    function Repair-FileLineEndings {
        param([string]$FilePath, [string]$FileType = "")
        if (Test-Path $FilePath) {
            try {
                $content = Get-Content $FilePath -Raw
                if ($content) {
                    # Convert to Unix line endings first, then to Windows if needed
                    $content = $content -replace "`r`n", "`n" -replace "`r", "`n"
                    if ($IsWindows) {
                        $content = $content -replace "`n", "`r`n"
                    }
                    [System.IO.File]::WriteAllText($FilePath, $content, [System.Text.Encoding]::UTF8)
                    Write-Host "  ✓ Fixed: $FilePath" -ForegroundColor Green
                }
            }
            catch {
                Write-Host "  ⚠️  Warning: Could not fix $FilePath - $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }

    # Fix critical files
    $criticalFiles = @(
        "docker/supabase/config.toml",
        "docker/supabase/seed.sql",
        "docker/.env",
        "docker/docker-compose.yml",
        "nuxt.config.ts",
        "package.json"
    )

    foreach ($file in $criticalFiles) {
        Repair-FileLineEndings $file "Critical"
    }

    # Fix SQL files
    Get-ChildItem -Path "." -Recurse -Include "*.sql" | ForEach-Object {
        Repair-FileLineEndings $_.FullName "SQL"
    }

    # Fix config files
    Get-ChildItem -Path "." -Recurse -Include "*.toml", "*.yaml", "*.yml" | ForEach-Object {
        Repair-FileLineEndings $_.FullName "Config"
    }

    Write-Host "✅ Line ending repairs completed" -ForegroundColor Green
}

# Function to validate and fix environment
function Test-Environment {
    Write-Host ""
    Write-Host "🔍 ENVIRONMENT VALIDATION..." -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-Host "  ✓ Docker available: $dockerVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ Docker not available or not running" -ForegroundColor Red
        throw "Docker is required but not available"
    }

    # Check docker-compose
    try {
        $composeVersion = docker-compose --version
        Write-Host "  ✓ Docker Compose available: $composeVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ Docker Compose not available" -ForegroundColor Red
        throw "Docker Compose is required but not available"
    }

    # Check required directories
    $requiredDirs = @("docker", "docker/supabase")
    foreach ($dir in $requiredDirs) {
        if (Test-Path $dir) {
            Write-Host "  ✓ Directory exists: $dir" -ForegroundColor Green
        }
        else {
            Write-Host "  ❌ Missing directory: $dir" -ForegroundColor Red
            throw "Required directory missing: $dir"
        }
    }

    # Check critical files
    $criticalFiles = @(
        "docker/docker-compose.yml",
        "docker/.env"
    )

    foreach ($file in $criticalFiles) {
        if (Test-Path $file) {
            Write-Host "  ✓ File exists: $file" -ForegroundColor Green
        }
        else {
            Write-Host "  ⚠️  Missing file: $file" -ForegroundColor Yellow
        }
    }
    Write-Host "✅ Environment validation completed" -ForegroundColor Green
}

# Function to check for common Supabase Analytics issue
function Test-SupabaseAnalyticsIssue {
    Write-Host ""
    Write-Host "🔍 CHECKING FOR COMMON ISSUES..." -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

    # Check if supabase_admin password configuration exists
    $rolesFile = "docker/volumes/db/roles.sql"
    if (Test-Path $rolesFile) {
        $rolesContent = Get-Content $rolesFile -Raw
        if ($rolesContent -notmatch "ALTER USER supabase_admin WITH PASSWORD") {
            Write-Host "⚠️  DETECTED COMMON ISSUE: Missing supabase_admin password configuration" -ForegroundColor Yellow
            Write-Host "   This can cause analytics service authentication failures." -ForegroundColor Yellow
            Write-Host "   Run .\scripts\21-fix-supabase-analytics.ps1 to fix this specific issue." -ForegroundColor Cyan
            Write-Host ""
        }
        else {
            Write-Host "✓ supabase_admin password configuration is present" -ForegroundColor Green
        }
    }
    else {
        Write-Host "⚠️  roles.sql file not found - will be created during setup" -ForegroundColor Yellow
    }

    # Check for running analytics container with errors
    try {
        $analyticsContainer = docker ps --filter "name=supabase-analytics" --format "{{.Names}}" 2>$null
        if ($analyticsContainer) {
            $analyticsLogs = docker logs supabase-analytics --tail 10 2>$null
            if ($analyticsLogs -match "password authentication failed for user.*supabase_admin") {
                Write-Host "❌ ACTIVE ISSUE: Analytics service has password authentication errors" -ForegroundColor Red
                Write-Host "   Run .\scripts\21-fix-supabase-analytics.ps1 to fix this issue." -ForegroundColor Cyan
                Write-Host ""
            }
        }
    }
    catch {
        # Container not running, which is expected during reset
    }
}

# Function to fix BOM issues in configuration files
function Repair-ConfigurationFiles {
    Write-Host ""
    Write-Host "🔧 FIXING CONFIGURATION FILE ENCODING ISSUES..." -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    # Fix BOM issues in Supabase config.toml
    $configFile = "supabase\config.toml"
    if (Test-Path $configFile) {
        try {
            # Read content and re-save without BOM
            $content = Get-Content -Path $configFile -Raw -Encoding UTF8
            if ($content) {
                # Remove BOM if present and save as UTF8 without BOM
                $utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
                [System.IO.File]::WriteAllText((Resolve-Path $configFile).Path, $content, $utf8NoBomEncoding)
                Write-Host "  ✓ Fixed BOM issue in: $configFile" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "  ⚠️  Warning: Could not fix BOM in $configFile - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    # Fix BOM issues in all migration files
    $migrationFiles = Get-ChildItem -Path "supabase\migrations" -Filter "*.sql" -ErrorAction SilentlyContinue
    foreach ($file in $migrationFiles) {
        try {
            $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
            if ($content) {
                $utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
                [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBomEncoding)
                Write-Host "  ✓ Fixed BOM in migration: $($file.Name)" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "  ⚠️  Warning: Could not fix BOM in $($file.Name) - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    # Fix other critical configuration files
    $configFiles = @(
        "package.json",
        "nuxt.config.ts",
        "tsconfig.json"
    )

    foreach ($file in $configFiles) {
        if (Test-Path $file) {
            try {
                $content = Get-Content -Path $file -Raw -Encoding UTF8
                if ($content) {
                    $utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
                    [System.IO.File]::WriteAllText((Resolve-Path $file).Path, $content, $utf8NoBomEncoding)
                    Write-Host "  ✓ Fixed encoding in: $file" -ForegroundColor Green
                }
            }
            catch {
                Write-Host "  ⚠️  Warning: Could not fix encoding in $file - $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }

    Write-Host "✅ Configuration file encoding fixes completed" -ForegroundColor Green
}

# Function to setup pgAdmin with pre-configured servers
function Initialize-PgAdmin {
    Write-Host ""
    Write-Host "🔧 SETTING UP PGADMIN..." -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

    # Ensure pgAdmin configuration directories exist
    $pgAdminConfigDir = "pgadmin-config"
    $pgAdminSqlDir = "$pgAdminConfigDir/sql-scripts"

    if (-not (Test-Path $pgAdminConfigDir)) {
        New-Item -ItemType Directory -Path $pgAdminConfigDir -Force | Out-Null
        Write-Host "  📁 Created pgAdmin config directory" -ForegroundColor Gray
    }

    if (-not (Test-Path $pgAdminSqlDir)) {
        New-Item -ItemType Directory -Path $pgAdminSqlDir -Force | Out-Null
        Write-Host "  📁 Created SQL scripts directory" -ForegroundColor Gray
    }

    # Create servers.json configuration
    $serversConfig = @{
        Servers = @{
            "1" = @{
                Name                 = "Local Supabase"
                Group                = "Supabase"
                Host                 = "supabase-db"
                Port                 = 5432
                MaintenanceDB        = "postgres"
                Username             = "postgres"
                PassFile             = "/pgpass"
                SSLMode              = "prefer"
                SSLCert              = "<STORAGE_DIR>/.postgresql/postgresql.crt"
                SSLKey               = "<STORAGE_DIR>/.postgresql/postgresql.key"
                SSLRootCert          = "<STORAGE_DIR>/.postgresql/root.crt"
                SSLCrl               = "<STORAGE_DIR>/.postgresql/root.crl"
                SSLCompression       = 0
                Timeout              = 10
                UseSSHTunnel         = 0
                TunnelHost           = ""
                TunnelPort           = 22
                TunnelUsername       = ""
                TunnelAuthentication = 0
                BGColor              = "#1a472a"
                FGColor              = "#ffffff"
                Service              = ""
                Comment              = "Local Supabase Development Database"
            }
            "2" = @{
                Name                 = "Cloud Supabase"
                Group                = "Supabase"
                Host                 = "db.oflctqligzouzshimuqh.supabase.co"
                Port                 = 5432
                MaintenanceDB        = "postgres"
                Username             = "postgres"
                PassFile             = "/pgpass"
                SSLMode              = "require"
                SSLCert              = "<STORAGE_DIR>/.postgresql/postgresql.crt"
                SSLKey               = "<STORAGE_DIR>/.postgresql/postgresql.key"
                SSLRootCert          = "<STORAGE_DIR>/.postgresql/root.crt"
                SSLCrl               = "<STORAGE_DIR>/.postgresql/root.crl"
                SSLCompression       = 0
                Timeout              = 10
                UseSSHTunnel         = 0
                TunnelHost           = ""
                TunnelPort           = 22
                TunnelUsername       = ""
                TunnelAuthentication = 0
                BGColor              = "#8b1538"
                FGColor              = "#ffffff"
                Service              = ""
                Comment              = "Cloud Supabase Production Database"
            }
        }
    }

    $serversJson = $serversConfig | ConvertTo-Json -Depth 10
    $serversJsonPath = "$pgAdminConfigDir/servers.json"
    Set-Content -Path $serversJsonPath -Value $serversJson -Encoding UTF8
    Write-Host "  ✓ Created servers.json configuration" -ForegroundColor Green

    # Create pgpass file for passwordless connections
    $pgpassContent = @"
# Local Supabase
supabase-db:5432:*:postgres:postgres
localhost:54322:*:postgres:postgres

# Cloud Supabase (replace with your actual password)
db.oflctqligzouzshimuqh.supabase.co:5432:*:postgres:your-cloud-password-here
"@

    $pgpassPath = "$pgAdminConfigDir/pgpass"
    Set-Content -Path $pgpassPath -Value $pgpassContent -Encoding UTF8
    Write-Host "  ✓ Created pgpass file" -ForegroundColor Green    # Create helpful SQL scripts
    New-PgAdminSqlScripts $pgAdminSqlDir

    # Create docker-compose.admin.yml if it doesn't exist
    if (-not (Test-Path "docker-compose.admin.yml")) {
        New-PgAdminDockerCompose
    }

    Write-Host "  ✅ pgAdmin configuration completed" -ForegroundColor Green
}

# Function to create useful SQL scripts
function New-PgAdminSqlScripts {
    param([string]$ScriptsDir)

    # Database overview script
    $databaseOverviewSql = @"
-- Database Overview and Health Check
-- Run this to get a complete overview of your database structure and health

-- 1. Database Information
SELECT
    'Database Info' as section,
    current_database() as database_name,
    current_user as current_user,
    version() as postgresql_version;

-- 2. Schema Overview
SELECT
    'Schemas' as section,
    schemaname as schema_name,
    count(*) as table_count
FROM pg_tables
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
GROUP BY schemaname
ORDER BY schemaname;

-- 3. Table Overview (Public Schema)
SELECT
    'Public Tables' as section,
    tablename as table_name,
    obj_description(c.oid) as table_comment,
    (SELECT count(*) FROM information_schema.columns WHERE table_name = t.tablename AND table_schema = 'public') as column_count
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
ORDER BY t.tablename;

-- 4. Auth Schema Tables
SELECT
    'Auth Tables' as section,
    tablename as table_name,
    (SELECT count(*) FROM information_schema.columns WHERE table_name = t.tablename AND table_schema = 'auth') as column_count
FROM pg_tables t
WHERE t.schemaname = 'auth'
ORDER BY t.tablename;

-- 5. Row Counts for All Tables
SELECT
    'Row Counts' as section,
    schemaname,
    tablename,
    (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
    SELECT
        schemaname,
        tablename,
        query_to_xml(format('select count(*) as cnt from %I.%I', schemaname, tablename), false, true, '') as xml_count
    FROM pg_tables
    WHERE schemaname IN ('public', 'auth')
) t
ORDER BY schemaname, tablename;
"@

    Set-Content -Path "$ScriptsDir/database-overview.sql" -Value $databaseOverviewSql -Encoding UTF8
    Write-Host "    ✓ Created database-overview.sql" -ForegroundColor Gray

    # Schema comparison script
    $schemaComparisonSql = @"
-- Schema Comparison Between Local and Cloud
-- Use this to compare table structures between environments

-- 1. Tables that exist in public schema
SELECT
    'Table Existence' as check_type,
    table_name,
    CASE
        WHEN table_schema = 'public' THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Column comparison for key tables
SELECT
    'Column Details' as check_type,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'userinfo', 'projects', 'user_profiles')
ORDER BY table_name, ordinal_position;

-- 3. Constraint information
SELECT
    'Constraints' as check_type,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;
"@

    Set-Content -Path "$ScriptsDir/schema-comparison.sql" -Value $schemaComparisonSql -Encoding UTF8
    Write-Host "    ✓ Created schema-comparison.sql" -ForegroundColor Gray

    # Data verification script
    $dataVerificationSql = @"
-- Data Verification and Sync Status
-- Use this to verify data consistency after syncing

-- 1. Quick row count comparison
SELECT
    'Row Counts' as check_type,
    'profiles' as table_name,
    count(*) as local_count
FROM public.profiles
UNION ALL
SELECT
    'Row Counts' as check_type,
    'userinfo' as table_name,
    count(*) as local_count
FROM public.userinfo
UNION ALL
SELECT
    'Row Counts' as check_type,
    'projects' as table_name,
    count(*) as local_count
FROM public.projects
UNION ALL
SELECT
    'Row Counts' as check_type,
    'auth.users' as table_name,
    count(*) as local_count
FROM auth.users;

-- 2. Sample data from key tables
SELECT 'Sample Profiles' as check_type, id, email, role, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

SELECT 'Sample Auth Users' as check_type, id, email, created_at, email_confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 3. Data integrity checks
SELECT
    'Data Integrity' as check_type,
    'Orphaned Profiles' as issue_type,
    count(*) as issue_count
FROM public.profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE u.id IS NULL;

-- 4. Recent activity
SELECT
    'Recent Activity' as check_type,
    'Last 24h Profiles' as activity_type,
    count(*) as count
FROM public.profiles
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'Recent Activity' as check_type,
    'Last 24h Auth Users' as activity_type,
    count(*) as count
FROM auth.users
WHERE created_at > NOW() - INTERVAL '24 hours';
"@

    Set-Content -Path "$ScriptsDir/data-verification.sql" -Value $dataVerificationSql -Encoding UTF8
    Write-Host "    ✓ Created data-verification.sql" -ForegroundColor Gray
}

# Function to create pgAdmin docker compose configuration
function New-PgAdminDockerCompose {
    $dockerComposeAdmin = @"
version: '3.8'

services:
  # pgAdmin - Web-based PostgreSQL administration
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: supabase-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@cloudless.gr
      PGADMIN_DEFAULT_PASSWORD: admin123
      PGADMIN_CONFIG_SERVER_MODE: 'False'
      PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED: 'False'
      PGADMIN_LISTEN_ADDRESS: '0.0.0.0'
      PGADMIN_LISTEN_PORT: 80
      PGADMIN_SERVER_JSON_FILE: '/pgadmin4/servers.json'
    ports:
      - '8080:80'
    volumes:
      - pgadmin_data:/var/lib/pgadmin
      - ./db-backups:/backups
      - ./pgadmin-config/servers.json:/pgadmin4/servers.json:ro
      - ./pgadmin-config/pgpass:/pgpass:ro
      - ./pgadmin-config/sql-scripts:/sql-scripts:ro
    networks:
      - supabase_default
    restart: unless-stopped
    depends_on:
      - db-sync

  # Optional: Database synchronization service
  db-sync:
    image: postgres:15
    container_name: supabase-sync-service
    environment:
      PGPASSWORD: postgres
    volumes:
      - ./sync-scripts:/scripts
      - ./db-backups:/backups
      - ./logs:/logs
    networks:
      - supabase_default
    restart: unless-stopped
    command: ["tail", "-f", "/dev/null"]  # Keep container running

volumes:
  pgadmin_data:
    driver: local

networks:
  supabase_default:
    external: true
"@

    Set-Content -Path "docker-compose.admin.yml" -Value $dockerComposeAdmin -Encoding UTF8
    Write-Host "  ✓ Created docker-compose.admin.yml" -ForegroundColor Green
}

# Function to start pgAdmin services
function Start-PgAdminServices {
    Write-Host ""
    Write-Host "🚀 STARTING PGADMIN SERVICES..." -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

    # Ensure required directories exist
    $requiredDirs = @("db-backups", "logs", "sync-scripts")
    foreach ($dir in $requiredDirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "  📁 Created $dir directory" -ForegroundColor Gray
        }
    }

    # Start pgAdmin services
    Write-Host "  🔄 Starting pgAdmin container..." -ForegroundColor Cyan
    docker-compose -f docker-compose.admin.yml up -d 2>&1 | Out-Host

    # Wait for pgAdmin to be ready
    Write-Host "  ⏳ Waiting for pgAdmin to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 8

    # Load server configurations
    try {
        Write-Host "  🔧 Loading server configurations..." -ForegroundColor Cyan

        # Create admin user if it doesn't exist
        $userCheck = docker exec supabase-pgadmin /venv/bin/python /pgadmin4/setup.py get-users 2>$null | Select-String "admin@cloudless.gr"
        if (-not $userCheck) {
            Write-Host "    👤 Creating admin user..." -ForegroundColor Gray
            docker exec supabase-pgadmin /venv/bin/python /pgadmin4/setup.py add-user admin@cloudless.gr admin123 --admin 2>$null | Out-Null
        }

        # Load servers for admin user
        $loadResult = docker exec supabase-pgadmin /venv/bin/python /pgadmin4/setup.py load-servers /pgadmin4/servers.json --user admin@cloudless.gr 2>$null

        if ($loadResult -match "Added.*Server") {
            Write-Host "    ✅ Server configurations loaded successfully" -ForegroundColor Green
        }
        else {
            Write-Host "    ℹ️  Server configurations already loaded" -ForegroundColor Cyan
        }
    }
    catch {
        Write-Host "    ⚠️  Could not auto-load servers: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "    💡 You can load them manually from pgAdmin interface" -ForegroundColor Gray
    }

    Write-Host "  ✅ pgAdmin setup completed" -ForegroundColor Green
    Write-Host ""
    Write-Host "  🌐 pgAdmin Access:" -ForegroundColor Cyan
    Write-Host "    • URL: http://localhost:8080" -ForegroundColor White
    Write-Host "    • Email: admin@cloudless.gr" -ForegroundColor White
    Write-Host "    • Password: admin123" -ForegroundColor White
    Write-Host ""
    Write-Host "  📁 Pre-configured servers:" -ForegroundColor Yellow
    Write-Host "    • Local Supabase (Green theme)" -ForegroundColor Green
    Write-Host "    • Cloud Supabase (Red theme)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  📝 SQL Scripts available in /sql-scripts:" -ForegroundColor Yellow
    Write-Host "    • database-overview.sql - Complete DB health check" -ForegroundColor Gray
    Write-Host "    • schema-comparison.sql - Compare schemas" -ForegroundColor Gray
    Write-Host "    • data-verification.sql - Verify sync status" -ForegroundColor Gray
}

# Main execution
Write-Host "🚀 COMPLETE SUPABASE RESET AND SEEDING SCRIPT" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Handle special modes
if ($FixLineEndings) {
    Repair-AllLineEndings
    Write-Host "🎉 Line ending fixes completed!" -ForegroundColor Green
    exit 0
}

if ($ValidateOnly) {
    Test-Environment
    Repair-AllLineEndings
    Write-Host "🎉 Environment validation completed!" -ForegroundColor Green
    exit 0
}

# Auto-force mode for speed
if ($Quick -or $NoCleanup) {
    $Force = $true
}

# Show configuration
Write-Host "⚙️  Configuration:" -ForegroundColor Cyan
Write-Host "  • Skip Seeding: $($SkipSeed -eq $true)" -ForegroundColor White
Write-Host "  • Development Mode: $($DevMode -eq $true)" -ForegroundColor White
Write-Host "  • Quick Mode: $($Quick -eq $true)" -ForegroundColor White
Write-Host "  • No Cleanup: $($NoCleanup -eq $true)" -ForegroundColor White
Write-Host "  • Force Mode: $($Force -eq $true)" -ForegroundColor White
Write-Host "  • Skip pgAdmin: $($SkipPgAdmin -eq $true)" -ForegroundColor White

if (-not $Force) {
    Write-Host ""
    Write-Host "⚠️  This will completely reset your Supabase environment" -ForegroundColor Yellow
    $response = Read-Host "Continue with reset? (Y/n)"
    if ($response -eq 'n' -or $response -eq 'N') {
        Write-Host "❌ Operation cancelled" -ForegroundColor Red
        exit 0
    }
}

$originalPath = Get-Location
$startTime = Get-Date

try {
    # Validate environment first
    Test-Environment

    # Check for common issues
    Test-SupabaseAnalyticsIssue
    # Fix line endings unless skipped
    if (-not $Quick) {
        Repair-AllLineEndings
    }

    # Fix configuration file encoding issues
    Repair-ConfigurationFiles

    # Change to docker directory
    Set-Location "docker"
    Write-Host ""
    Write-Host "📍 Working in: $(Get-Location)" -ForegroundColor Cyan

    # PHASE 1: CLEANUP
    if (-not $NoCleanup) {
        Write-Host ""
        Write-Host "🧹 CLEANUP PHASE..." -ForegroundColor Yellow
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

        # Stop all containers
        Write-Host "  🛑 Stopping containers..." -ForegroundColor Cyan
        docker-compose down --remove-orphans 2>&1 | Out-Host

        # Remove volumes unless quick mode
        if (-not $Quick) {
            Write-Host "  🗑️  Removing volumes..." -ForegroundColor Cyan
            docker-compose down -v 2>&1 | Out-Host

            # Clean up any remaining volumes
            try {
                $volumes = docker volume ls -q | Where-Object { $_ -match "supabase|postgres|docker" }
                if ($volumes) {
                    Write-Host "  🗑️  Cleaning remaining volumes..." -ForegroundColor Cyan
                    docker volume rm $volumes 2>&1 | Out-Host
                }
            }
            catch {
                Write-Host "  ⚠️  Some volumes couldn't be removed (they may not exist)" -ForegroundColor Yellow
            }
        }
    }

    # PHASE 2: STARTUP
    Write-Host ""
    Write-Host "🚀 STARTUP PHASE..." -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

    # Start services
    $composeFile = if ($DevMode) { "docker-compose.dev.yml" } else { "docker-compose.yml" }
    Write-Host "  🔄 Starting services with $composeFile..." -ForegroundColor Cyan
    docker-compose -f $composeFile up -d 2>&1 | Out-Host

    # Wait for services
    Write-Host "  ⏳ Waiting for services to be ready..." -ForegroundColor Cyan
    Start-Sleep -Seconds 10    # Check service status
    Write-Host "  📊 Service status:" -ForegroundColor Cyan
    docker-compose ps 2>&1 | Out-Host    # PHASE 2.5: PGADMIN SETUP
    if (-not $SkipPgAdmin) {
        Write-Host ""
        Write-Host "🔧 PGADMIN SETUP PHASE..." -ForegroundColor Cyan
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

        # Move back to root directory for pgAdmin setup
        Set-Location ".."
        Initialize-PgAdmin
        Start-PgAdminServices
        Set-Location "docker"
    }

    # PHASE 3: SEEDING
    if (-not $SkipSeed) {
        Write-Host ""
        Write-Host "🌱 SEEDING PHASE..." -ForegroundColor Green
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

        # Wait a bit more for database to be fully ready
        Start-Sleep -Seconds 5

        # Run seeding script if it exists
        if (Test-Path "../scripts/seed-database.js") {
            Write-Host "  🌱 Running database seeding..." -ForegroundColor Cyan
            Set-Location ".."
            node scripts/seed-database.js 2>&1 | Out-Host
            Set-Location "docker"
        }
        else {
            Write-Host "  ⚠️  Seeding script not found, skipping..." -ForegroundColor Yellow
        }
    }

    # PHASE 4: COMPLETION
    $endTime = Get-Date
    $duration = $endTime - $startTime

    Write-Host ""
    Write-Host "🎉 RESET COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "⏱️  Total time: $($duration.Minutes)m $($duration.Seconds)s" -ForegroundColor Cyan    Write-Host ""
    Write-Host "🌐 Access Points:" -ForegroundColor Cyan
    Write-Host "  • Supabase Studio: http://localhost:54323" -ForegroundColor White
    Write-Host "  • Database: localhost:54322" -ForegroundColor White
    Write-Host "  • API: http://localhost:54321" -ForegroundColor White
    if (-not $SkipPgAdmin) {
        Write-Host "  • pgAdmin: http://localhost:8080 (admin@cloudless.gr / admin123)" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Check service status: docker-compose ps" -ForegroundColor White
    Write-Host "  2. View logs: docker-compose logs -f" -ForegroundColor White
    Write-Host "  3. Run tests: .\scripts\11-test-authentication.js" -ForegroundColor White
    if (-not $SkipPgAdmin) {
        Write-Host "  4. Access pgAdmin for database management and SQL scripts" -ForegroundColor White
        Write-Host "  5. Use sync scripts to sync cloud data: .\sync-comprehensive.ps1" -ForegroundColor White
    }

}
catch {
    Write-Host ""
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Try running with -ValidateOnly to check your environment" -ForegroundColor Yellow
    exit 1
}
finally {
    Set-Location $originalPath
}
