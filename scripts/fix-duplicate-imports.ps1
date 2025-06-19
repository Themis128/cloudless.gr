#!/usr/bin/env pwsh
# Fix duplicate imports script - consolidates utility functions

Write-Host "🔧 Fixing duplicate imports..." -ForegroundColor Green

# Step 1: Check current state
Write-Host "📊 Analyzing duplicate imports..." -ForegroundColor Yellow

$duplicates = @{
    "formatDate" = @("utils/index.ts", "utils/project.ts")
    "safeStatusDisplay" = @("utils/auth.ts", "utils/project.ts")
    "safeMetricValue" = @("utils/index.ts", "utils/training.ts")
    "safeMetricProperty" = @("utils/index.ts", "utils/training.ts")
}

# Step 2: Consolidate utilities to primary locations
Write-Host "🎯 Consolidating utilities to primary locations..." -ForegroundColor Cyan

# Keep formatDate only in utils/project.ts (domain-specific)
if (Test-Path "utils/index.ts") {
    $indexContent = Get-Content "utils/index.ts" -Raw
    # Remove formatDate from index.ts if it exists
    $indexContent = $indexContent -replace '(?s)export function formatDate.*?(?=export|$)', ''
    $indexContent = $indexContent -replace '\n\s*\n\s*\n', "`n`n"  # Clean up extra newlines
    Set-Content "utils/index.ts" $indexContent.Trim() -NoNewline
    Write-Host "✅ Removed formatDate from utils/index.ts" -ForegroundColor Green
}

# Keep safeStatusDisplay only in utils/project.ts (domain-specific)
if (Test-Path "utils/auth.ts") {
    $authContent = Get-Content "utils/auth.ts" -Raw
    # Remove safeStatusDisplay from auth.ts if it exists
    $authContent = $authContent -replace '(?s)export function safeStatusDisplay.*?(?=export|$)', ''
    $authContent = $authContent -replace '\n\s*\n\s*\n', "`n`n"  # Clean up extra newlines
    Set-Content "utils/auth.ts" $authContent.Trim() -NoNewline
    Write-Host "✅ Removed safeStatusDisplay from utils/auth.ts" -ForegroundColor Green
}

# Keep safeMetricValue and safeMetricProperty only in utils/training.ts (domain-specific)
if (Test-Path "utils/index.ts") {
    $indexContent = Get-Content "utils/index.ts" -Raw
    # Remove metric functions from index.ts if they exist
    $indexContent = $indexContent -replace '(?s)export function safeMetricValue.*?(?=export|$)', ''
    $indexContent = $indexContent -replace '(?s)export function safeMetricProperty.*?(?=export|$)', ''
    $indexContent = $indexContent -replace '\n\s*\n\s*\n', "`n`n"  # Clean up extra newlines
    Set-Content "utils/index.ts" $indexContent.Trim() -NoNewline
    Write-Host "✅ Removed metric functions from utils/index.ts" -ForegroundColor Green
}

# Step 3: Update Nuxt auto-imports config to prevent conflicts
Write-Host "⚙️ Updating nuxt.config.ts for better auto-imports..." -ForegroundColor Yellow

if (Test-Path "nuxt.config.ts") {
    $nuxtContent = Get-Content "nuxt.config.ts" -Raw

    # Check if we need to add specific import mappings
    if ($nuxtContent -notmatch "imports:") {
        $importConfig = @"

  imports: {
    dirs: [
      'utils/project.ts',    // formatDate, safeStatusDisplay
      'utils/training.ts',   // safeMetricValue, safeMetricProperty
      'utils/auth.ts',       // auth utilities
      'utils/index.ts'       // general utilities
    ]
  },
"@
        $nuxtContent = $nuxtContent -replace "(export default defineNuxtConfig\(\{)", "`$1$importConfig"
        Set-Content "nuxt.config.ts" $nuxtContent -NoNewline
        Write-Host "✅ Updated nuxt.config.ts with import priorities" -ForegroundColor Green
    }
}

# Step 4: Test for remaining duplicates
Write-Host "🔍 Testing for remaining duplicates..." -ForegroundColor Yellow

$npm_output = & npm run typecheck 2>&1 | Out-String
$duplicate_warnings = $npm_output | Select-String "Duplicated imports"

if ($duplicate_warnings) {
    Write-Host "⚠️ Found remaining duplicates:" -ForegroundColor Red
    $duplicate_warnings | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
} else {
    Write-Host "✅ No duplicate import warnings found!" -ForegroundColor Green
}

Write-Host "`n🎉 Duplicate imports fix complete!" -ForegroundColor Green
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run 'npm run dev' to test the application" -ForegroundColor White
Write-Host "  2. Run 'npm run typecheck' to verify no duplicate warnings" -ForegroundColor White
Write-Host "  3. Check Jenkins pipeline for automated detection" -ForegroundColor White
