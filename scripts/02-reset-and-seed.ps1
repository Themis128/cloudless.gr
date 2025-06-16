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
#   .\scripts\02-reset-and-seed.ps1                    # Full reset with seeding
#   .\scripts\02-reset-and-seed.ps1 -SkipSeed         # Reset without seeding
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
    [switch]$ValidateOnly
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
function Validate-Environment {
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
        } else {
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
        } else {
            Write-Host "  ⚠️  Missing file: $file" -ForegroundColor Yellow
        }
    }
    
    Write-Host "✅ Environment validation completed" -ForegroundColor Green
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
    Validate-Environment
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
    Validate-Environment
    
    # Fix line endings unless skipped
    if (-not $Quick) {
        Repair-AllLineEndings
    }
    
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
    Start-Sleep -Seconds 10
    
    # Check service status
    Write-Host "  📊 Service status:" -ForegroundColor Cyan
    docker-compose ps 2>&1 | Out-Host
    
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
        } else {
            Write-Host "  ⚠️  Seeding script not found, skipping..." -ForegroundColor Yellow
        }
    }
    
    # PHASE 4: COMPLETION
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-Host ""
    Write-Host "🎉 RESET COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "⏱️  Total time: $($duration.Minutes)m $($duration.Seconds)s" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🌐 Access Points:" -ForegroundColor Cyan
    Write-Host "  • Supabase Studio: http://localhost:54323" -ForegroundColor White
    Write-Host "  • Database: localhost:54322" -ForegroundColor White
    Write-Host "  • API: http://localhost:54321" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Check service status: docker-compose ps" -ForegroundColor White
    Write-Host "  2. View logs: docker-compose logs -f" -ForegroundColor White
    Write-Host "  3. Run tests: .\scripts\11-test-authentication.js" -ForegroundColor White
    
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
