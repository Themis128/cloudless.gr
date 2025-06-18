#!/usr/bin/env pwsh
# Quick Supabase Reset Script - IPv6 Compatible
# Simple wrapper for the enhanced reset script

param(
    [switch]$Quick,
    [switch]$NoSeed,
    [switch]$NoPgAdmin,
    [switch]$Force
)

Write-Host "🚀 Quick Supabase Reset - IPv6 Compatible Version" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Gray
Write-Host ""

# Build arguments for the enhanced script
$scriptArgs = @()

if ($Quick) {
    $scriptArgs += "-Quick"
}

if ($NoSeed) {
    $scriptArgs += "-SkipSeed"
}

if ($NoPgAdmin) {
    $scriptArgs += "-SkipPgAdmin"
}

if ($Force) {
    $scriptArgs += "-Force"
}

# Check if enhanced script exists
if (Test-Path "reset-and-seed-enhanced.ps1") {
    Write-Host "Executing enhanced reset script..." -ForegroundColor Yellow
    & "./reset-and-seed-enhanced.ps1" @scriptArgs
}
else {
    Write-Host "❌ Enhanced reset script not found!" -ForegroundColor Red
    Write-Host "Please ensure 'reset-and-seed-enhanced.ps1' exists in the current directory." -ForegroundColor Gray
    exit 1
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Reset completed successfully!" -ForegroundColor Green
    Write-Host "Your local Supabase environment is ready for development." -ForegroundColor White
    Write-Host "No more IPv6 connectivity issues! 🎉" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "❌ Reset failed. Check the output above for details." -ForegroundColor Red
}
