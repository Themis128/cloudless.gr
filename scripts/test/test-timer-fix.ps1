# Test Timer Fix Script
# This script restarts the development server to test if timer warnings are resolved

Write-Host "Testing Timer Fix..." -ForegroundColor Green

# Stop any running Nuxt processes
Write-Host "Stopping any running Nuxt processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "node" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Wait a moment for processes to stop
Start-Sleep -Seconds 2

# Clear console
Clear-Host

Write-Host "Starting development server with timer fixes..." -ForegroundColor Green
Write-Host "Watch for timer warnings in the output below:" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan

# Start the development server
npm run dev 