# Supabase Line Endings Fix Script
# Fixes line ending issues that cause Elixir parsing errors in Supabase
#
# Usage:
#   .\scripts\fix-line-endings.ps1           # Fix all files
#   .\scripts\fix-line-endings.ps1 -Verbose # Show detailed output

param(
    [switch]$Verbose
)

Write-Host "🔧 SUPABASE LINE ENDINGS FIX" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Prevents Elixir errors like: 'unexpected token: carriage return (U+000D)'" -ForegroundColor Yellow
Write-Host ""

# Function to fix individual file line endings
function Repair-FileLineEndings {
    param([string]$FilePath, [string]$FileType = "")
    
    if (-not (Test-Path $FilePath)) {
        if ($Verbose) {
            Write-Host "  ⏭️  Skipped (not found): $FilePath" -ForegroundColor Gray
        }
        return $false
    }
    
    try {
        $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
        if (-not $content) {
            if ($Verbose) {
                Write-Host "  ⏭️  Skipped (empty): $FilePath" -ForegroundColor Gray
            }
            return $false
        }
        
        $hasChanges = $false
        
        # Fix CRLF to LF
        if ($content.Contains("`r`n")) {
            $content = $content -replace "`r`n", "`n"
            $hasChanges = $true
        }
        
        # Fix standalone CR to LF
        if ($content.Contains("`r")) {
            $content = $content -replace "`r", "`n"
            $hasChanges = $true
        }
        
        if ($hasChanges) {
            # Write with UTF8 encoding and LF line endings
            [System.IO.File]::WriteAllText($FilePath, $content, [System.Text.Encoding]::UTF8)
            Write-Host "  ✅ Fixed: $FilePath $FileType" -ForegroundColor Green
            return $true
        } else {
            if ($Verbose) {
                Write-Host "  ✓ OK: $FilePath $FileType" -ForegroundColor DarkGreen
            }
            return $false
        }
    } catch {
        Write-Host "  ❌ Error fixing: $FilePath - $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

$fixedCount = 0
$totalFiles = 0

# CRITICAL: Elixir files (most important to fix)
Write-Host "🔹 Checking Elixir files..." -ForegroundColor Cyan
$elixirFiles = @(
    "docker/volumes/pooler/pooler.exs"
)

foreach ($file in $elixirFiles) {
    $totalFiles++
    if (Repair-FileLineEndings $file "(Elixir - CRITICAL)") {
        $fixedCount++
    }
}

# SQL files that may contain embedded code or be processed by Elixir
Write-Host "🔹 Checking SQL files..." -ForegroundColor Cyan
$sqlFiles = @(
    "docker/volumes/db/jwt.sql",
    "docker/volumes/db/roles.sql", 
    "docker/volumes/db/webhooks.sql",
    "docker/volumes/db/realtime.sql",
    "docker/volumes/db/_supabase.sql",
    "docker/volumes/db/logs.sql",
    "docker/volumes/db/pooler.sql",
    "docker/dev/seed.sql",
    "docker/dev/data.sql"
)

foreach ($file in $sqlFiles) {
    $totalFiles++
    if (Repair-FileLineEndings $file "(SQL)") {
        $fixedCount++
    }
}

# Script files
Write-Host "🔹 Checking script files..." -ForegroundColor Cyan
$scriptFiles = @(
    "scripts/add-themis-admin.sql",
    "scripts/add-themis-user.sql", 
    "scripts/quick-keys.sql",
    "scripts/database-keys-retrieval.sql"
)

foreach ($file in $scriptFiles) {
    $totalFiles++
    if (Repair-FileLineEndings $file "(Script)") {
        $fixedCount++
    }
}

# Configuration files
Write-Host "🔹 Checking configuration files..." -ForegroundColor Cyan
$configFiles = @(
    "docker/docker-compose.yml",
    "docker/.env",
    ".env"
)

foreach ($file in $configFiles) {
    $totalFiles++
    if (Repair-FileLineEndings $file "(Config)") {
        $fixedCount++
    }
}

# Summary
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if ($fixedCount -gt 0) {
    Write-Host "🎯 FIXED LINE ENDINGS IN $fixedCount OF $totalFiles FILES" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ This should resolve Elixir parsing errors like:" -ForegroundColor Green
    Write-Host "   • 'unexpected token: carriage return (code point U+000D)'" -ForegroundColor Gray
    Write-Host "   • 'invalid syntax found on nofile:XX:X'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🚀 Now restart Supabase:" -ForegroundColor Cyan
    Write-Host "   cd docker" -ForegroundColor White
    Write-Host "   docker compose down" -ForegroundColor White
    Write-Host "   docker compose up -d" -ForegroundColor White
} else {
    Write-Host "✅ ALL $totalFiles FILES ALREADY HAVE CORRECT LINE ENDINGS" -ForegroundColor Green
    Write-Host "   No Elixir parsing errors expected from line endings." -ForegroundColor Gray
}

Write-Host ""
Write-Host "💡 Tip: Use -Verbose flag to see all files checked" -ForegroundColor Cyan
