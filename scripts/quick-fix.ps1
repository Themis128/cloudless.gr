#!/usr/bin/env pwsh
#Requires -Version 7.0

<#
.SYNOPSIS
    Quick Application Recovery Script
.DESCRIPTION
    Fast recovery script for common application issues without full environment reset.
    Use this when you need to quickly fix common problems without nuclear option.
.NOTES
    Author: CloudlessGR Development Team
    Version: 1.0
    Last Updated: June 16, 2025
#>

param(
    [switch]$FixUrls,
    [switch]$FixLineEndings,
    [switch]$RestartServices,
    [switch]$CheckHealth,
    [switch]$All
)

# Script configuration
$BaseDirectory = Split-Path -Parent $PSScriptRoot
$ErrorActionPreference = "Continue"

function Write-Status {
    param(
        [string]$Message,
        [string]$Type = "INFO"
    )
    
    $colors = @{
        "INFO" = "White"
        "SUCCESS" = "Green"
        "WARN" = "Yellow"
        "ERROR" = "Red"
        "TITLE" = "Cyan"
    }
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $colors[$Type]
}

function Show-QuickFixBanner {
    Write-Host ""
    Write-Host "🔧 QUICK APPLICATION FIX" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan
    Write-Host ""
}

# Fix hardcoded URLs to use port 8000 instead of 54321
function Fix-HardcodedUrls {
    Write-Status "Fixing hardcoded URLs..." "TITLE"
    
    $filesToFix = @(
        @{ Path = "nuxt.config.ts"; Pattern = "54321"; Replacement = "8000" },
        @{ Path = "scripts\retrieve-keys.js"; Pattern = "54321"; Replacement = "8000" },
        @{ Path = "scripts\seed-database.js"; Pattern = "54321"; Replacement = "8000" }
    )
    
    foreach ($file in $filesToFix) {
        $fullPath = Join-Path $BaseDirectory $file.Path
        if (Test-Path $fullPath) {
            try {
                $content = Get-Content $fullPath -Raw
                if ($content -match $file.Pattern) {
                    $newContent = $content -replace $file.Pattern, $file.Replacement
                    Set-Content $fullPath $newContent -Encoding UTF8
                    Write-Status "✓ Fixed URLs in $($file.Path)" "SUCCESS"
                } else {
                    Write-Status "✓ URLs already correct in $($file.Path)" "SUCCESS"
                }
            }
            catch {
                Write-Status "✗ Failed to fix $($file.Path): $($_.Exception.Message)" "ERROR"
            }
        }
    }
    
    # Check and fix .env files
    $envFiles = @(".env", "docker\.env")
    foreach ($envFile in $envFiles) {
        $fullPath = Join-Path $BaseDirectory $envFile
        if (Test-Path $fullPath) {
            try {
                $content = Get-Content $fullPath -Raw
                if ($content -match "SUPABASE_URL=.*54321") {
                    $newContent = $content -replace "SUPABASE_URL=.*54321", "SUPABASE_URL=http://127.0.0.1:8000"
                    Set-Content $fullPath $newContent -Encoding UTF8
                    Write-Status "✓ Fixed SUPABASE_URL in $envFile" "SUCCESS"
                } else {
                    Write-Status "✓ SUPABASE_URL already correct in $envFile" "SUCCESS"
                }
            }
            catch {
                Write-Status "✗ Failed to fix $envFile: $($_.Exception.Message)" "ERROR"
            }
        }
    }
}

# Fix line endings for critical files
function Fix-CriticalLineEndings {
    Write-Status "Fixing line endings..." "TITLE"
    
    $criticalFiles = @(
        "docker\volumes\pooler\pooler.exs",
        "docker\volumes\db\*.sql",
        "docker\dev\*.sql"
    )
    
    foreach ($pattern in $criticalFiles) {
        $files = Get-ChildItem -Path $BaseDirectory -Filter ($pattern.Split('\')[-1]) -Recurse -ErrorAction SilentlyContinue
        
        foreach ($file in $files) {
            if ($file.FullName -like "*$($pattern.Replace('*', '*'))*") {
                try {
                    $content = Get-Content $file.FullName -Raw
                    if ($content -and $content.Contains("`r`n")) {
                        $content = $content -replace "`r`n", "`n"
                        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
                        Write-Status "✓ Fixed line endings: $($file.Name)" "SUCCESS"
                    }
                }
                catch {
                    Write-Status "✗ Failed to fix line endings for $($file.Name): $($_.Exception.Message)" "ERROR"
                }
            }
        }
    }
}

# Restart Docker services
function Restart-DockerServices {
    Write-Status "Restarting Docker services..." "TITLE"
    
    try {
        Set-Location (Join-Path $BaseDirectory "docker")
        
        Write-Status "Stopping services..." "INFO"
        docker-compose down
        
        Start-Sleep 5
        
        Write-Status "Starting services..." "INFO"
        docker-compose up -d
        
        # Wait for services to be ready
        Write-Status "Waiting for services to be ready..." "INFO"
        $maxWait = 60
        $waited = 0
        
        while ($waited -lt $maxWait) {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    Write-Status "✓ Services are ready!" "SUCCESS"
                    break
                }
            }
            catch { }
            
            Start-Sleep 5
            $waited += 5
            Write-Status "Waiting... ($waited/$maxWait seconds)" "INFO"
        }
        
        if ($waited -ge $maxWait) {
            Write-Status "⚠ Services may not be fully ready yet" "WARN"
        }
    }
    catch {
        Write-Status "✗ Error restarting services: $($_.Exception.Message)" "ERROR"
    }
    finally {
        Set-Location $BaseDirectory
    }
}

# Check application health
function Check-ApplicationHealth {
    Write-Status "Checking application health..." "TITLE"
    
    $checks = @(
        @{ Name = "Kong API Gateway"; Url = "http://localhost:8000/health" },
        @{ Name = "Auth Service"; Url = "http://localhost:8000/auth/v1/health" },
        @{ Name = "REST API"; Url = "http://localhost:8000/rest/v1/" },
        @{ Name = "Database Connection"; Url = "http://localhost:8000/rest/v1/rpc/version" }
    )
    
    $allHealthy = $true
    
    foreach ($check in $checks) {
        try {
            $response = Invoke-WebRequest -Uri $check.Url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
            Write-Status "✓ $($check.Name) is healthy (Status: $($response.StatusCode))" "SUCCESS"
        }
        catch {
            Write-Status "✗ $($check.Name) is not healthy: $($_.Exception.Message)" "ERROR"
            $allHealthy = $false
        }
    }
    
    # Check Docker containers
    Write-Status "Checking Docker containers..." "INFO"
    try {
        $containers = docker ps --format "table {{.Names}}\t{{.Status}}" | Select-Object -Skip 1
        foreach ($container in $containers) {
            if ($container -match "Up") {
                $name = ($container -split "\s+")[0]
                Write-Status "✓ Container $name is running" "SUCCESS"
            } else {
                Write-Status "✗ Container issue: $container" "ERROR"
                $allHealthy = $false
            }
        }
    }
    catch {
        Write-Status "✗ Error checking Docker containers: $($_.Exception.Message)" "ERROR"
        $allHealthy = $false
    }
    
    if ($allHealthy) {
        Write-Status "🎉 All health checks passed!" "SUCCESS"
        Write-Host ""
        Write-Host "Application endpoints:" -ForegroundColor Cyan
        Write-Host "  • API: http://localhost:8000" -ForegroundColor White
        Write-Host "  • Studio: http://localhost:3000 (if started)" -ForegroundColor White
        Write-Host ""
        Write-Host "To start the frontend:" -ForegroundColor Yellow
        Write-Host "  npm run dev" -ForegroundColor White
    } else {
        Write-Status "⚠ Some health checks failed" "WARN"
        Write-Host ""
        Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
        Write-Host "  1. Check Docker logs: docker-compose logs" -ForegroundColor White
        Write-Host "  2. Restart services: .\scripts\quick-fix.ps1 -RestartServices" -ForegroundColor White
        Write-Host "  3. Run full restore: .\scripts\emergency-restore.ps1" -ForegroundColor White
    }
    
    return $allHealthy
}

# Show usage information
function Show-Usage {
    Write-Host ""
    Write-Host "🔧 Quick Fix Script Usage:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Fix specific issues:" -ForegroundColor White
    Write-Host "  .\scripts\quick-fix.ps1 -FixUrls           # Fix hardcoded port 54321 -> 8000" -ForegroundColor Gray
    Write-Host "  .\scripts\quick-fix.ps1 -FixLineEndings    # Fix Windows line endings" -ForegroundColor Gray
    Write-Host "  .\scripts\quick-fix.ps1 -RestartServices   # Restart Docker services" -ForegroundColor Gray
    Write-Host "  .\scripts\quick-fix.ps1 -CheckHealth       # Check application health" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Fix everything:" -ForegroundColor White
    Write-Host "  .\scripts\quick-fix.ps1 -All               # Run all fixes" -ForegroundColor Gray
    Write-Host ""
    Write-Host "For complete reset, use:" -ForegroundColor Yellow
    Write-Host "  .\scripts\emergency-restore.ps1" -ForegroundColor Gray
    Write-Host ""
}

# Main execution
function Main {
    Show-QuickFixBanner
    
    if (-not ($FixUrls -or $FixLineEndings -or $RestartServices -or $CheckHealth -or $All)) {
        Show-Usage
        return
    }
    
    if ($All) {
        $FixUrls = $true
        $FixLineEndings = $true
        $RestartServices = $true
        $CheckHealth = $true
    }
    
    try {
        if ($FixUrls) {
            Fix-HardcodedUrls
            Write-Host ""
        }
        
        if ($FixLineEndings) {
            Fix-CriticalLineEndings
            Write-Host ""
        }
        
        if ($RestartServices) {
            Restart-DockerServices
            Write-Host ""
        }
        
        if ($CheckHealth) {
            Check-ApplicationHealth
            Write-Host ""
        }
        
        Write-Status "Quick fix completed!" "SUCCESS"
        
    }
    catch {
        Write-Status "Error during quick fix: $($_.Exception.Message)" "ERROR"
        Write-Host ""
        Write-Host "For complete recovery, run:" -ForegroundColor Yellow
        Write-Host "  .\scripts\emergency-restore.ps1" -ForegroundColor White
    }
}

# Execute main function
Main
