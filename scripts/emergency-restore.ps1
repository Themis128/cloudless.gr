#!/usr/bin/env pwsh
#Requires -Version 7.0

<#
.SYNOPSIS
    Emergency Application Restore Script
.DESCRIPTION
    Comprehensive recovery script to restore the entire application to a known working state.
    This script handles Docker environment, Supabase setup, environment configuration, 
    line ending fixes, and complete application restoration.
.NOTES
    Author: CloudlessGR Development Team
    Version: 1.0
    Last Updated: June 16, 2025
#>

param(
    [switch]$SkipConfirmation,
    [switch]$VerboseOutput,
    [switch]$ForceCleanStart
)

# Enhanced error handling
$ErrorActionPreference = "Stop"
$WarningPreference = "Continue"

# Script configuration
$BaseDirectory = Split-Path -Parent $PSScriptRoot
$LogFile = Join-Path $BaseDirectory "logs\emergency-restore-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$BackupDir = Join-Path $BaseDirectory "backups\emergency-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Ensure logs directory exists
$LogsDir = Join-Path $BaseDirectory "logs"
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

# Logging function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO",
        [string]$Color = "White"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Write to console with color
    Write-Host $logEntry -ForegroundColor $Color
    
    # Write to log file
    Add-Content -Path $LogFile -Value $logEntry -Encoding UTF8
}

# Emergency restore banner
function Show-Banner {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "            🚨 EMERGENCY APPLICATION RESTORE 🚨" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host ""
    Write-Host "This script will restore your application to a known working state." -ForegroundColor White
    Write-Host "⚠️  WARNING: This will:" -ForegroundColor Yellow
    Write-Host "   • Stop all Docker containers" -ForegroundColor White
    Write-Host "   • Remove Docker volumes (data loss possible)" -ForegroundColor White
    Write-Host "   • Reset all configuration files" -ForegroundColor White
    Write-Host "   • Rebuild the entire environment" -ForegroundColor White
    Write-Host ""
}

# Backup critical files
function Backup-CriticalFiles {
    Write-Log "Creating backup of critical files..." "INFO" "Yellow"
    
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }
    
    $criticalFiles = @(
        ".env",
        "docker/.env",
        "nuxt.config.ts",
        "package.json",
        "docker/docker-compose.yml"
    )
    
    foreach ($file in $criticalFiles) {
        $fullPath = Join-Path $BaseDirectory $file
        if (Test-Path $fullPath) {
            $backupPath = Join-Path $BackupDir $file
            $backupDirPath = Split-Path $backupPath -Parent
            if (-not (Test-Path $backupDirPath)) {
                New-Item -ItemType Directory -Path $backupDirPath -Force | Out-Null
            }
            Copy-Item $fullPath $backupPath -Force
            Write-Log "Backed up: $file" "INFO" "Green"
        }
    }
}

# Clean Docker environment completely
function Clean-DockerEnvironment {
    Write-Log "Cleaning Docker environment..." "INFO" "Yellow"
    
    try {
        # Stop all containers
        Write-Log "Stopping all Docker containers..." "INFO" "White"
        docker stop $(docker ps -aq) 2>$null
        
        # Remove all containers
        Write-Log "Removing all Docker containers..." "INFO" "White"
        docker rm $(docker ps -aq) 2>$null
        
        # Remove all volumes
        Write-Log "Removing all Docker volumes..." "INFO" "White"
        docker volume prune -f 2>$null
        
        # Remove all networks (except default ones)
        Write-Log "Removing custom Docker networks..." "INFO" "White"
        docker network prune -f 2>$null
        
        # Clean up images (optional - commented out to preserve build cache)
        # docker image prune -a -f 2>$null
        
        Write-Log "Docker environment cleaned successfully" "SUCCESS" "Green"
    }
    catch {
        Write-Log "Error cleaning Docker environment: $($_.Exception.Message)" "ERROR" "Red"
        throw
    }
}

# Fix line endings for all critical files
function Fix-LineEndings {
    Write-Log "Fixing line endings for critical files..." "INFO" "Yellow"
    
    $filePatterns = @(
        "docker/volumes/**/*.sql",
        "docker/volumes/**/*.exs",
        "docker/dev/**/*.sql",
        "scripts/**/*.ps1",
        "scripts/**/*.js",
        "*.env*",
        "docker/*.env*"
    )
    
    foreach ($pattern in $filePatterns) {
        $files = Get-ChildItem -Path $BaseDirectory -Filter $pattern.Split('/')[-1] -Recurse -ErrorAction SilentlyContinue
        
        foreach ($file in $files) {
            if ($file.FullName -match ($pattern -replace '\*\*', '.*' -replace '\*', '.*')) {
                try {
                    $content = Get-Content $file.FullName -Raw
                    if ($content -and $content.Contains("`r`n")) {
                        $content = $content -replace "`r`n", "`n"
                        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
                        Write-Log "Fixed line endings: $($file.Name)" "INFO" "Green"
                    }
                }
                catch {
                    Write-Log "Failed to fix line endings for $($file.Name): $($_.Exception.Message)" "WARN" "Yellow"
                }
            }
        }
    }
}

# Create/restore environment files
function Restore-EnvironmentFiles {
    Write-Log "Restoring environment files..." "INFO" "Yellow"
    
    # Main .env file
    $mainEnvContent = @"
# Database Configuration
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Supabase Configuration
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTAwMjEyMDAsImV4cCI6MTkwNzc4NzYwMH0.n7S053n5q1Ih3_cJmdyBSUuiPmemvB3ZJgvEUoVKZ6M

# JWT Configuration
JWT_SECRET=eOvlpJPRGfQkptMLRFSfCPerPR5MkrekkpIuLqXd

# Application Configuration
NODE_ENV=development
PORT=3000

# Storage Configuration (S3-compatible)
S3_ACCESS_KEY=625729a08b95bf1b7ff351a663f3a23c
S3_SECRET_KEY=850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
S3_REGION=local
"@

    # Docker .env file
    $dockerEnvContent = @"
############
# Secrets
# YOU MUST CHANGE THESE BEFORE GOING TO PRODUCTION
############

POSTGRES_PASSWORD=postgres

############
# Database - You can change these to any PostgreSQL database that has logical replication enabled.
############

POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432
# default user is postgres

############
# API Proxy - Configuration for the Kong Reverse proxy.
############

KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# API - Configuration for PostgREST.
############

PGRST_DB_SCHEMAS=public,storage,graphql_public

############
# Auth - Configuration for the GoTrue authentication server.
############

## General
SITE_URL=http://localhost:3000
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=http://localhost:8000

## Mailer Config
MAILER_AUTOCONFIRM=false
# MAILER_SECURE_EMAIL_CHANGE_ENABLED=true
# MAILER_OTP_EXP=86400
# SMTP_ADMIN_EMAIL=admin@example.com
# SMTP_HOST=supabase-mail
# SMTP_PORT=2500
# SMTP_USER=fake_mail_user
# SMTP_PASS=fake_mail_password
# SMTP_SENDER_NAME=fake_sender

## Mobile Auth (optional)
# ENABLE_PHONE_AUTOCONFIRM=true
# ENABLE_PHONE_SIGNUP=true

############
# Studio - Configuration for the Dashboard
############

STUDIO_DEFAULT_ORGANIZATION=Default Organization
STUDIO_DEFAULT_PROJECT=Default Project

STUDIO_PORT=3000
# replace if you intend to use Studio outside of localhost
SUPABASE_PUBLIC_URL=http://localhost:8000

# Enable webp
IMGPROXY_ENABLE_WEBP_DETECTION=true

############
# Functions - Configuration for Functions
############
# NOTE: VERIFY_JWT applies to all functions. Per-function jwt verification is not supported yet.
FUNCTIONS_VERIFY_JWT=false

############
# Logs - Configuration for Logflare
# Please refer to https://supabase.com/docs/reference/self-hosting-analytics/introduction
############

# Comment variables to enable analytics.
# LOGFLARE_LOGGER_BACKEND_API_KEY=your-secret-here

# Change vector.toml sinks to reflect this change:
# LOGFLARE_API_KEY=your-secret-here

# Docker socket location - this value will differ depending on your OS
# DOCKER_SOCKET_LOCATION=/var/run/docker.sock

# Google Cloud Project details
# GOOGLE_PROJECT_ID=GOOGLE_PROJECT_ID
# GOOGLE_PROJECT_NUMBER=GOOGLE_PROJECT_NUMBER
"@

    # Write environment files
    Set-Content -Path (Join-Path $BaseDirectory ".env") -Value $mainEnvContent -Encoding UTF8
    Write-Log "Created main .env file" "SUCCESS" "Green"
    
    Set-Content -Path (Join-Path $BaseDirectory "docker\.env") -Value $dockerEnvContent -Encoding UTF8
    Write-Log "Created docker .env file" "SUCCESS" "Green"
}

# Restore Nuxt configuration
function Restore-NuxtConfig {
    Write-Log "Restoring Nuxt configuration..." "INFO" "Yellow"
    
    $nuxtConfigContent = @"
// nuxt.config.ts
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  ssr: false, // Optional: Use SSR if you need it
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },
  css: ["vuetify/styles"],
  build: {
    transpile: ["vuetify"],
  },
  modules: ["@nuxtjs/supabase"],
  supabase: {
    url: "http://127.0.0.1:8000",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ",
    redirectOptions: {
      login: '/auth',
      callback: '/',
      exclude: ['/', '/info', '/info/*', '/auth', '/auth/*']
    }
  },
  runtimeConfig: {
    public: {
      supabaseUrl: "http://127.0.0.1:8000",
      supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ",
    },
  },
  vite: {
    define: {
      "process.env.DEBUG": false,
    },
  },
});
"@

    Set-Content -Path (Join-Path $BaseDirectory "nuxt.config.ts") -Value $nuxtConfigContent -Encoding UTF8
    Write-Log "Restored Nuxt configuration" "SUCCESS" "Green"
}

# Restore critical Docker files
function Restore-DockerFiles {
    Write-Log "Ensuring Docker configuration is correct..." "INFO" "Yellow"
    
    # Check if pooler.exs exists and fix if needed
    $poolerPath = Join-Path $BaseDirectory "docker\volumes\pooler\pooler.exs"
    if (Test-Path $poolerPath) {
        $poolerContent = Get-Content $poolerPath -Raw
        if ($poolerContent -match '^use Mix\.Config') {
            Write-Log "Fixing pooler.exs format..." "WARN" "Yellow"
            
            $correctPoolerContent = @"
use Mix.Config

config :pgbouncer,
  host: {:system, "PGBOUNCER_HOST", "db"},
  port: {:system, "PGBOUNCER_PORT", 5432, {String, :to_integer}},
  pool_size: {:system, "PGBOUNCER_POOL_SIZE", 25, {String, :to_integer}},
  default_pool_size: {:system, "PGBOUNCER_DEFAULT_POOL_SIZE", 25, {String, :to_integer}},
  max_client_conn: {:system, "PGBOUNCER_MAX_CLIENT_CONN", 100, {String, :to_integer}},
  max_db_connections: {:system, "PGBOUNCER_MAX_DB_CONNECTIONS", 100, {String, :to_integer}},
  auth_type: {:system, "PGBOUNCER_AUTH_TYPE", "md5"},
  auth_file: {:system, "PGBOUNCER_AUTH_FILE", "/etc/pgbouncer/userlist.txt"},
  databases: %{
    postgres: [
      host: {:system, "PGBOUNCER_HOST", "db"},
      port: {:system, "PGBOUNCER_PORT", 5432, {String, :to_integer}},
      pool_size: {:system, "PGBOUNCER_POOL_SIZE", 25, {String, :to_integer}}
    ]
  }
"@
            
            Set-Content -Path $poolerPath -Value $correctPoolerContent -Encoding UTF8
            Write-Log "Fixed pooler.exs configuration" "SUCCESS" "Green"
        }
    }
}

# Start Docker services
function Start-DockerServices {
    Write-Log "Starting Docker services..." "INFO" "Yellow"
    
    try {
        Set-Location (Join-Path $BaseDirectory "docker")
        
        # Pull latest images
        Write-Log "Pulling latest Docker images..." "INFO" "White"
        docker-compose pull
        
        # Start services
        Write-Log "Starting Docker Compose services..." "INFO" "White"
        docker-compose up -d
        
        Write-Log "Docker services started successfully" "SUCCESS" "Green"
    }
    catch {
        Write-Log "Error starting Docker services: $($_.Exception.Message)" "ERROR" "Red"
        throw
    }
    finally {
        Set-Location $BaseDirectory
    }
}

# Wait for services to be ready
function Wait-ForServices {
    Write-Log "Waiting for services to be ready..." "INFO" "Yellow"
    
    $maxWaitTime = 300 # 5 minutes
    $waitInterval = 10
    $elapsed = 0
    
    while ($elapsed -lt $maxWaitTime) {
        try {
            # Check if Kong is responding
            $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Log "Services are ready!" "SUCCESS" "Green"
                return $true
            }
        }
        catch {
            # Service not ready yet
        }
        
        Write-Log "Waiting for services... ($elapsed/$maxWaitTime seconds)" "INFO" "Cyan"
        Start-Sleep $waitInterval
        $elapsed += $waitInterval
    }
    
    Write-Log "Services did not become ready within $maxWaitTime seconds" "WARN" "Yellow"
    return $false
}

# Run database seeding
function Seed-Database {
    Write-Log "Seeding database..." "INFO" "Yellow"
    
    try {
        # Wait a bit more for database to be fully ready
        Start-Sleep 15
        
        # Run the seeding script
        $seedScript = Join-Path $BaseDirectory "scripts\seed-database.js"
        if (Test-Path $seedScript) {
            node $seedScript
            Write-Log "Database seeded successfully" "SUCCESS" "Green"
        } else {
            Write-Log "Seed script not found, creating users manually..." "WARN" "Yellow"
            
            # Create admin user using PowerShell script
            $addAdminScript = Join-Path $BaseDirectory "scripts\add-admin.js"
            if (Test-Path $addAdminScript) {
                node $addAdminScript
                Write-Log "Admin user created" "SUCCESS" "Green"
            }
        }
    }
    catch {
        Write-Log "Error seeding database: $($_.Exception.Message)" "WARN" "Yellow"
        Write-Log "You may need to seed the database manually" "INFO" "White"
    }
}

# Install/restore Node dependencies
function Restore-NodeDependencies {
    Write-Log "Restoring Node.js dependencies..." "INFO" "Yellow"
    
    try {
        # Clean install
        if (Test-Path "node_modules") {
            Remove-Item "node_modules" -Recurse -Force
        }
        
        if (Test-Path "package-lock.json") {
            Remove-Item "package-lock.json" -Force
        }
        
        npm install
        Write-Log "Node.js dependencies restored" "SUCCESS" "Green"
    }
    catch {
        Write-Log "Error restoring Node.js dependencies: $($_.Exception.Message)" "WARN" "Yellow"
    }
}

# Verify application health
function Test-ApplicationHealth {
    Write-Log "Testing application health..." "INFO" "Yellow"
    
    $healthChecks = @(
        @{ Name = "Kong API Gateway"; Url = "http://localhost:8000/health"; Expected = 200 },
        @{ Name = "Auth Service"; Url = "http://localhost:8000/auth/v1/health"; Expected = 200 },
        @{ Name = "REST API"; Url = "http://localhost:8000/rest/v1/"; Expected = 200 }
    )
    
    $allHealthy = $true
    
    foreach ($check in $healthChecks) {
        try {
            $response = Invoke-WebRequest -Uri $check.Url -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -eq $check.Expected) {
                Write-Log "✓ $($check.Name) is healthy" "SUCCESS" "Green"
            } else {
                Write-Log "✗ $($check.Name) returned status $($response.StatusCode)" "ERROR" "Red"
                $allHealthy = $false
            }
        }
        catch {
            Write-Log "✗ $($check.Name) is not responding: $($_.Exception.Message)" "ERROR" "Red"
            $allHealthy = $false
        }
    }
    
    return $allHealthy
}

# Generate recovery summary
function Show-RecoverySummary {
    param([bool]$Success)
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
    Write-Host "                    RECOVERY SUMMARY" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
    Write-Host ""
    
    if ($Success) {
        Write-Host "🎉 Emergency restore completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Your application has been restored with:" -ForegroundColor White
        Write-Host "  ✓ Clean Docker environment" -ForegroundColor Green
        Write-Host "  ✓ Correct environment configuration" -ForegroundColor Green
        Write-Host "  ✓ Fixed line endings" -ForegroundColor Green
        Write-Host "  ✓ Updated URLs (port 8000)" -ForegroundColor Green
        Write-Host "  ✓ Seeded database" -ForegroundColor Green
        Write-Host "  ✓ Healthy services" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 Access your application at:" -ForegroundColor Cyan
        Write-Host "  • Frontend: http://localhost:3000" -ForegroundColor White
        Write-Host "  • API: http://localhost:8000" -ForegroundColor White
        Write-Host "  • Studio: http://localhost:3000" -ForegroundColor White
        Write-Host ""
        Write-Host "📝 To start the frontend:" -ForegroundColor Yellow
        Write-Host "  npm run dev" -ForegroundColor White
    } else {
        Write-Host "⚠️  Recovery completed with issues" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Some steps may have failed. Check the log file:" -ForegroundColor White
        Write-Host "  $LogFile" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "You may need to:" -ForegroundColor Yellow
        Write-Host "  • Check Docker service logs: docker-compose logs" -ForegroundColor White
        Write-Host "  • Manually seed the database" -ForegroundColor White
        Write-Host "  • Verify environment variables" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "📄 Backup created at:" -ForegroundColor Cyan
    Write-Host "  $BackupDir" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Log file:" -ForegroundColor Cyan
    Write-Host "  $LogFile" -ForegroundColor White
    Write-Host ""
}

# Main execution
function Main {
    try {
        Show-Banner
        
        if (-not $SkipConfirmation) {
            $confirmation = Read-Host "Do you want to proceed with emergency restore? (y/N)"
            if ($confirmation -notmatch '^[Yy]') {
                Write-Host "Emergency restore cancelled." -ForegroundColor Yellow
                return
            }
        }
        
        Write-Log "Starting emergency application restore..." "INFO" "Cyan"
        Write-Log "Log file: $LogFile" "INFO" "White"
        
        # Step 1: Backup current state
        Backup-CriticalFiles
        
        # Step 2: Clean Docker environment
        if ($ForceCleanStart) {
            Clean-DockerEnvironment
        }
        
        # Step 3: Fix line endings
        Fix-LineEndings
        
        # Step 4: Restore configuration files
        Restore-EnvironmentFiles
        Restore-NuxtConfig
        Restore-DockerFiles
        
        # Step 5: Start Docker services
        Start-DockerServices
        
        # Step 6: Wait for services
        $servicesReady = Wait-ForServices
        
        # Step 7: Seed database
        if ($servicesReady) {
            Seed-Database
        }
        
        # Step 8: Restore Node dependencies
        Restore-NodeDependencies
        
        # Step 9: Health check
        $isHealthy = Test-ApplicationHealth
        
        # Step 10: Show summary
        Show-RecoverySummary -Success ($servicesReady -and $isHealthy)
        
        Write-Log "Emergency restore process completed" "SUCCESS" "Green"
        
    }
    catch {
        Write-Log "CRITICAL ERROR: $($_.Exception.Message)" "ERROR" "Red"
        Write-Log "Stack trace: $($_.Exception.StackTrace)" "ERROR" "Red"
        
        Show-RecoverySummary -Success $false
        
        throw
    }
}

# Execute main function
Main
