#!/usr/bin/env pwsh
# Jenkins TypeScript Quality Gate Script
# This script runs comprehensive TypeScript checks and auto-fixes for Jenkins CI/CD

param(
    [int]$MaxErrors = 20,
    [switch]$AutoFix = $false,
    [switch]$Detailed = $false
)

Write-Host "🔍 Jenkins TypeScript Quality Gate Starting..." -ForegroundColor Blue

# Function to extract error count from typecheck output
function Get-TypeScriptErrorCount {
    param([string]$LogFile)

    if (Test-Path $LogFile) {
        $content = Get-Content $LogFile -Raw
        if ($content -match "Found (\d+) errors?") {
            return [int]$matches[1]
        }
    }
    return 0
}

# Function to categorize errors by severity
function Get-ErrorsByCategory {
    param([string]$LogFile)

    if (-not (Test-Path $LogFile)) {
        return @{ Critical = 0; Warning = 0; Info = 0 }
    }

    $content = Get-Content $LogFile -Raw
    $critical = ($content | Select-String -Pattern "error TS2345|error TS2589|error TS2339" -AllMatches).Matches.Count
    $warning = ($content | Select-String -Pattern "error TS18047|error TS2322" -AllMatches).Matches.Count
    $info = ($content | Select-String -Pattern "error TS1005|error TS1109" -AllMatches).Matches.Count

    return @{
        Critical = $critical
        Warning = $warning
        Info = $info
    }
}

# Step 1: Initial TypeScript Check
Write-Host "📝 Running initial TypeScript check..." -ForegroundColor Yellow
& npm run typecheck 2>&1 | Tee-Object -FilePath "typescript-initial.log" | Out-Null
$initialErrors = Get-TypeScriptErrorCount "typescript-initial.log"

Write-Host "Initial TypeScript errors: $initialErrors" -ForegroundColor $(if ($initialErrors -eq 0) { "Green" } else { "Red" })

# Step 2: Auto-fix if requested and errors found
if ($AutoFix -and $initialErrors -gt 0) {
    Write-Host "🔧 Running auto-fix scripts..." -ForegroundColor Cyan

    # Run the auto-fix script
    try {
        & .\.vscode\auto-fix-errors.ps1
        Write-Host "✅ Auto-fix completed" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Auto-fix had issues: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    # Re-run TypeScript check
    Write-Host "📝 Re-running TypeScript check after auto-fix..." -ForegroundColor Yellow
    & npm run typecheck 2>&1 | Tee-Object -FilePath "typescript-post-fix.log" | Out-Null
    $postFixErrors = Get-TypeScriptErrorCount "typescript-post-fix.log"

    $improvement = $initialErrors - $postFixErrors
    Write-Host "TypeScript errors after auto-fix: $postFixErrors (improved by $improvement)" -ForegroundColor $(if ($improvement -gt 0) { "Green" } else { "Yellow" })

    $finalErrors = $postFixErrors
    $finalLogFile = "typescript-post-fix.log"
} else {
    $finalErrors = $initialErrors
    $finalLogFile = "typescript-initial.log"
}

# Step 3: Detailed error analysis
if ($Detailed -and $finalErrors -gt 0) {
    Write-Host "📊 Detailed error analysis:" -ForegroundColor Blue
    $categories = Get-ErrorsByCategory $finalLogFile

    Write-Host "  Critical errors (type mismatches, missing properties): $($categories.Critical)" -ForegroundColor Red
    Write-Host "  Warning errors (null safety, type assertions): $($categories.Warning)" -ForegroundColor Yellow
    Write-Host "  Info errors (syntax, minor issues): $($categories.Info)" -ForegroundColor Cyan

    # Show top error patterns
    Write-Host "📋 Top error patterns:" -ForegroundColor Blue
    if (Test-Path $finalLogFile) {
        $content = Get-Content $finalLogFile
        $errorPatterns = $content | Where-Object { $_ -match "error TS\d+" } |
                        ForEach-Object {
                            $parts = ($_ -split "error ")
                            if ($parts.Length -gt 1) {
                                ($parts[1] -split ":")[0]
                            }
                        } |
                        Where-Object { $_ -ne $null } |
                        Group-Object | Sort-Object Count -Descending | Select-Object -First 5

        foreach ($pattern in $errorPatterns) {
            Write-Host "  $($pattern.Name): $($pattern.Count) occurrences" -ForegroundColor White
        }
    }
}

# Step 4: Quality Gate Decision
Write-Host "🚦 Quality Gate Evaluation:" -ForegroundColor Blue

if ($finalErrors -eq 0) {
    Write-Host "✅ PASS: No TypeScript errors found!" -ForegroundColor Green
    exit 0
} elseif ($finalErrors -le $MaxErrors) {
    Write-Host "⚠️ UNSTABLE: $finalErrors errors found (within threshold of $MaxErrors)" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "❌ FAIL: $finalErrors errors found (exceeds threshold of $MaxErrors)" -ForegroundColor Red
    Write-Host "💡 Suggestion: Run auto-fix or review critical errors manually" -ForegroundColor Cyan
    exit 1
}
