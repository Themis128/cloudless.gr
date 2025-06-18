#!/usr/bin/env pwsh
# Enhanced Supabase Reset and Seed Script - IPv6 Compatible Version
# This script completely resets Supabase and seeds it with test data
# Handles IPv6 connectivity issues by using local development environment

param(
    [switch]$SkipSeed,
    [switch]$DevMode,
    [switch]$Quick,
    [switch]$Force,
    [switch]$NoCleanup,
    [switch]$ValidateOnly,
    [switch]$SkipPgAdmin
)

function Write-ColoredOutput {
    param($Message, $Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Show-Banner {
    Write-ColoredOutput "🔄 SUPABASE RESET & SEED SCRIPT - IPv6 COMPATIBLE" "Cyan"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"
    Write-ColoredOutput ""

    if ($ValidateOnly) {
        Write-ColoredOutput "🔍 VALIDATION MODE - No changes will be made" "Yellow"
    }
    elseif ($Quick) {
        Write-ColoredOutput "⚡ QUICK MODE - Minimal reset, faster startup" "Green"
    }
    elseif ($DevMode) {
        Write-ColoredOutput "🛠️  DEVELOPMENT MODE - Enhanced logging and debugging" "Blue"
    }
    else {
        Write-ColoredOutput "🔧 FULL RESET MODE - Complete environment reset" "Magenta"
    }

    Write-ColoredOutput ""
    Write-ColoredOutput "Configuration:" "Yellow"
    Write-ColoredOutput "• Seed database: $(-not $SkipSeed)" "Gray"
    Write-ColoredOutput "• Setup pgAdmin: $(-not $SkipPgAdmin)" "Gray"
    Write-ColoredOutput "• Clean volumes: $(-not $NoCleanup)" "Gray"
    Write-ColoredOutput "• Force mode: $Force" "Gray"
    Write-ColoredOutput ""
}

function Test-Prerequisites {
    Write-ColoredOutput "🔍 CHECKING PREREQUISITES..." "Yellow"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

    $allGood = $true

    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-ColoredOutput "✅ Docker: $dockerVersion" "Green"
    }
    catch {
        Write-ColoredOutput "❌ Docker not found or not running" "Red"
        $allGood = $false
    }

    # Check Docker Compose
    try {
        $composeVersion = docker-compose --version
        Write-ColoredOutput "✅ Docker Compose: $composeVersion" "Green"
    }
    catch {
        Write-ColoredOutput "❌ Docker Compose not found" "Red"
        $allGood = $false
    }

    # Check Node.js (for seeding)
    if (-not $SkipSeed) {
        try {
            $nodeVersion = node --version
            Write-ColoredOutput "✅ Node.js: $nodeVersion" "Green"
        }
        catch {
            Write-ColoredOutput "⚠️  Node.js not found - seeding will be skipped" "Yellow"
            $SkipSeed = $true
        }
    }

    # Check required directories
    $requiredDirs = @("docker", "scripts")
    foreach ($dir in $requiredDirs) {
        if (Test-Path $dir) {
            Write-ColoredOutput "✅ Directory: $dir" "Green"
        }
        else {
            Write-ColoredOutput "❌ Missing directory: $dir" "Red"
            $allGood = $false
        }
    }

    Write-ColoredOutput ""
    return $allGood
}

function Stop-SupabaseServices {
    Write-ColoredOutput "🛑 STOPPING SUPABASE SERVICES..." "Yellow"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

    Push-Location "docker"
    try {
        # Stop main services
        Write-ColoredOutput "Stopping main Supabase services..." "White"
        docker-compose down -v --remove-orphans

        # Stop pgAdmin if running
        Write-ColoredOutput "Stopping pgAdmin services..." "White"
        docker-compose -f ../docker-compose.admin.yml down -v --remove-orphans 2>$null

        Write-ColoredOutput "✅ All services stopped" "Green"
    }
    catch {
        Write-ColoredOutput "⚠️  Some services may still be running: $($_.Exception.Message)" "Yellow"
    }
    finally {
        Pop-Location
    }
}

function Clear-Volumes {
    if ($NoCleanup) {
        Write-ColoredOutput "🔄 SKIPPING VOLUME CLEANUP (--NoCleanup flag)" "Yellow"
        return
    }

    Write-ColoredOutput "🧹 CLEANING VOLUMES AND DATA..." "Yellow"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

    $volumeDirs = @(
        "docker/volumes/db/data",
        "docker/volumes/storage",
        "pgadmin-config/sessions",
        "pgadmin-config/storage"
    )

    foreach ($dir in $volumeDirs) {
        if (Test-Path $dir) {
            Write-ColoredOutput "🗑️  Removing: $dir" "Gray"
            Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
        }
        else {
            Write-ColoredOutput "📁 Directory not found: $dir (skipping)" "Gray"
        }
    }

    # Clean Docker volumes
    Write-ColoredOutput "🐳 Cleaning Docker volumes..." "White"
    docker volume prune -f 2>$null

    Write-ColoredOutput "✅ Cleanup completed" "Green"
}

function Set-Environment {
    Write-ColoredOutput "🔧 CONFIGURING ENVIRONMENT FOR LOCAL DEVELOPMENT..." "Yellow"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

    # Update .env for local development (IPv6 fix)
    $envContent = @"
# Environment Variables - Local Development Configuration
# Updated by reset script to avoid IPv6 connectivity issues

# ========================================
# SUPABASE CONFIGURATION (LOCAL)
# ========================================

# For Local Development (Supabase CLI) - ACTIVE
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZn7aIQlFSXfRCVAUl9k6PeNmCkaDTKHTH98

# For Production/Cloud Supabase (DISABLED due to IPv6 connectivity issues)
# SUPABASE_URL=https://oflctqligzouzshimuqh.supabase.co
# SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MTQ3NDUsImV4cCI6MjA2NDM5MDc0NX0.Z1VgH0O77UM2Zb-J4a3fWNTTSFsfHZFmhsAUKJCJInc
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODgxNDc0NSwiZXhwIjoyMDY0MzkwNzQ1fQ.Sm4HwwS-MJw5KM96eJF5_aCOuv-I-v9Gohnmxo7cMXY

# ========================================
# APPLICATION CONFIGURATION
# ========================================
NUXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
PORT=3000

# ========================================
# SECURITY KEYS
# ========================================
JWT_SECRET=eOvlpJPRGfQkptMLRFSfCPerPR5MkrekkpIuLqXd
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
API_SECRET_KEY=your_api_secret_key_here
SESSION_SECRET=your_session_secret_here
"@

    $envContent | Set-Content ".env"
    Write-ColoredOutput "✅ Environment configured for local development" "Green"
    Write-ColoredOutput "   • Local Supabase URL: http://127.0.0.1:8000" "Gray"
    Write-ColoredOutput "   • Cloud URL disabled (IPv6 issues)" "Gray"
}

function Start-SupabaseServices {
    Write-ColoredOutput "🚀 STARTING SUPABASE SERVICES..." "Yellow"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

    Push-Location "docker"
    try {
        Write-ColoredOutput "Starting main Supabase stack..." "White"
        docker-compose up -d

        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "✅ Main services started successfully" "Green"
        }
        else {
            Write-ColoredOutput "❌ Failed to start main services" "Red"
            return $false
        }

        # Start pgAdmin if not skipped
        if (-not $SkipPgAdmin) {
            Write-ColoredOutput "Starting pgAdmin..." "White"
            docker-compose -f ../docker-compose.admin.yml up -d

            if ($LASTEXITCODE -eq 0) {
                Write-ColoredOutput "✅ pgAdmin started successfully" "Green"
            }
            else {
                Write-ColoredOutput "⚠️  pgAdmin failed to start (continuing anyway)" "Yellow"
            }
        }

        return $true
    }
    catch {
        Write-ColoredOutput "❌ Error starting services: $($_.Exception.Message)" "Red"
        return $false
    }
    finally {
        Pop-Location
    }
}

function Wait-ForServices {
    Write-ColoredOutput "⏳ WAITING FOR SERVICES TO BE READY..." "Yellow"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

    $maxAttempts = 30
    $attempt = 0

    while ($attempt -lt $maxAttempts) {
        $attempt++
        Write-ColoredOutput "Attempt $attempt/$maxAttempts - Testing Supabase API..." "Gray"

        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000" -Method HEAD -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 401) {
                Write-ColoredOutput "✅ Supabase API is responding (port 8000)" "Green"
                break
            }
        }
        catch {
            # Expected for unauthenticated requests
            if ($_.Exception.Response.StatusCode -eq 401) {
                Write-ColoredOutput "✅ Supabase API is responding (port 8000)" "Green"
                break
            }
        }

        if ($attempt -eq $maxAttempts) {
            Write-ColoredOutput "⚠️  Supabase API not responding after $maxAttempts attempts" "Yellow"
            Write-ColoredOutput "Services may still be starting up. Check manually with:" "Gray"
            Write-ColoredOutput "curl -I http://127.0.0.1:8000" "Gray"
        }
        else {
            Start-Sleep -Seconds 2
        }
    }
}

function Update-PgAdminServers {
    if ($SkipPgAdmin) {
        return
    }

    Write-ColoredOutput "🔧 UPDATING PGADMIN SERVER CONFIGURATION..." "Yellow"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

    try {
        if (Test-Path "update-pgadmin-servers.ps1") {
            & "./update-pgadmin-servers.ps1"
            Write-ColoredOutput "✅ pgAdmin servers updated" "Green"
        }
        else {
            Write-ColoredOutput "⚠️  pgAdmin update script not found" "Yellow"
        }
    }
    catch {
        Write-ColoredOutput "⚠️  Error updating pgAdmin servers: $($_.Exception.Message)" "Yellow"
    }
}

function Invoke-DatabaseSeeding {
    if ($SkipSeed) {
        Write-ColoredOutput "🌱 SKIPPING DATABASE SEEDING (--SkipSeed flag)" "Yellow"
        return
    }

    Write-ColoredOutput "🌱 SEEDING DATABASE..." "Yellow"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

    if (Test-Path "scripts/07-seed-database.js") {
        try {
            Write-ColoredOutput "Running database seeding script..." "White"
            node scripts/07-seed-database.js

            if ($LASTEXITCODE -eq 0) {
                Write-ColoredOutput "✅ Database seeding completed" "Green"
            }
            else {
                Write-ColoredOutput "❌ Database seeding failed" "Red"
                Write-ColoredOutput "You can run it manually later: node scripts/07-seed-database.js" "Gray"
            }
        }
        catch {
            Write-ColoredOutput "❌ Error running seeding script: $($_.Exception.Message)" "Red"
        }
    }
    else {
        Write-ColoredOutput "⚠️  Seeding script not found: scripts/07-seed-database.js" "Yellow"
    }
}

function Show-Results {
    Write-ColoredOutput ""
    Write-ColoredOutput "🎉 RESET AND SETUP COMPLETE!" "Green"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"
    Write-ColoredOutput ""

    Write-ColoredOutput "🌐 ACCESS POINTS:" "Cyan"
    Write-ColoredOutput "• Supabase Studio: http://127.0.0.1:54323" "White"
    Write-ColoredOutput "• Supabase API: http://127.0.0.1:8000" "White"
    Write-ColoredOutput "• Database (direct): localhost:5432" "White"

    if (-not $SkipPgAdmin) {
        Write-ColoredOutput "• pgAdmin: http://localhost:8080" "White"
        Write-ColoredOutput "  - Email: admin@cloudless.gr" "Gray"
        Write-ColoredOutput "  - Password: admin123" "Gray"
    }

    Write-ColoredOutput ""
    Write-ColoredOutput "🔧 NEXT STEPS:" "Cyan"
    Write-ColoredOutput "1. Start your Nuxt development server: npm run dev" "White"
    Write-ColoredOutput "2. Your app will connect to local Supabase automatically" "White"
    Write-ColoredOutput "3. No more IPv6 connectivity issues!" "White"

    if (-not $SkipSeed) {
        Write-ColoredOutput ""
        Write-ColoredOutput "👥 SEEDED TEST ACCOUNTS:" "Cyan"
        Write-ColoredOutput "• admin@cloudless.gr (admin)" "White"
        Write-ColoredOutput "• demo@cloudless.gr (user)" "White"
        Write-ColoredOutput "• test@example.com (user)" "White"
        Write-ColoredOutput "• john.doe@example.com (user)" "White"
    }

    Write-ColoredOutput ""
    Write-ColoredOutput "💡 Environment configured for IPv4-only local development" "Yellow"
    Write-ColoredOutput "This avoids all IPv6 connectivity issues with cloud Supabase." "Gray"
}

# Main execution flow
try {
    Show-Banner

    if ($ValidateOnly) {
        Test-Prerequisites
        Write-ColoredOutput "✅ Validation complete" "Green"
        exit 0
    }

    # Get user confirmation unless forced
    if (-not $Force -and -not $Quick) {
        Write-ColoredOutput "⚠️  WARNING: This will completely reset your Supabase environment!" "Red"
        Write-ColoredOutput "All database data will be lost!" "Red"
        Write-ColoredOutput ""
        $confirmation = Read-Host "Continue? (y/N)"
        if ($confirmation -ne "y" -and $confirmation -ne "Y") {
            Write-ColoredOutput "❌ Operation cancelled" "Yellow"
            exit 0
        }
    }

    # Check prerequisites
    if (-not (Test-Prerequisites)) {
        Write-ColoredOutput "❌ Prerequisites not met. Please fix the issues above and try again." "Red"
        exit 1
    }

    # Execute reset and setup
    Stop-SupabaseServices

    if (-not $Quick) {
        Clear-Volumes
    }

    Set-Environment

    if (Start-SupabaseServices) {
        Wait-ForServices
        Update-PgAdminServers
        Invoke-DatabaseSeeding
        Show-Results
    }
    else {
        Write-ColoredOutput "❌ Failed to start services. Check Docker logs for details." "Red"
        exit 1
    }

}
catch {
    Write-ColoredOutput "❌ Script failed with error: $($_.Exception.Message)" "Red"
    Write-ColoredOutput "Stack trace: $($_.Exception.StackTrace)" "Gray"
    exit 1
}
