# Cloudless.gr Startup Optimization Script
# This script optimizes application startup performance

param(
  [switch]$Monitor,
  [switch]$Optimize,
  [switch]$Cleanup,
  [int]$Port = 3000
)

Write-Host "🚀 Cloudless.gr Startup Optimization" -ForegroundColor Cyan

if ($Monitor) {
  Write-Host "📊 Monitoring startup performance..." -ForegroundColor Yellow

  # Kill existing Node.js processes
  Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 2

  # Clear cache
  if (Test-Path ".nuxt") {
    Remove-Item ".nuxt" -Recurse -Force
    Write-Host "✅ Cleared .nuxt cache" -ForegroundColor Green
  }

  # Start timing
  $startTime = Get-Date

  # Start the development server
  Write-Host "🔄 Starting development server..." -ForegroundColor Yellow
  $process = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru -WindowStyle Hidden

  # Wait for server to be ready
  $maxWaitTime = 60  # 60 seconds
  $waitTime = 0
  $serverReady = $false

  while ($waitTime -lt $maxWaitTime -and -not $serverReady) {
    try {
      $response = Invoke-WebRequest -Uri "http://localhost:$Port/api/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
      if ($response.StatusCode -eq 200) {
        $serverReady = $true
        $endTime = Get-Date
        $startupTime = ($endTime - $startTime).TotalSeconds

        Write-Host "✅ Server started successfully!" -ForegroundColor Green
        Write-Host "⏱️  Startup time: $startupTime seconds" -ForegroundColor Cyan

        # Performance analysis
        if ($startupTime -lt 10) {
          Write-Host "🎉 Excellent startup performance!" -ForegroundColor Green
        }
        elseif ($startupTime -lt 20) {
          Write-Host "👍 Good startup performance" -ForegroundColor Yellow
        }
        else {
          Write-Host "⚠️  Startup time could be improved" -ForegroundColor Red
        }

        # Monitor memory usage
        $memoryUsage = (Get-Process -Id $process.Id).WorkingSet / 1MB
        Write-Host "💾 Memory usage: $([math]::Round($memoryUsage, 2)) MB" -ForegroundColor Cyan

        break
      }
    }
    catch {
      # Server not ready yet
    }

    Start-Sleep -Seconds 1
    $waitTime++
    Write-Host "⏳ Waiting for server... ($waitTime/$maxWaitTime)" -ForegroundColor Gray
  }

  if (-not $serverReady) {
    Write-Host "❌ Server failed to start within $maxWaitTime seconds" -ForegroundColor Red
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    exit 1
  }

  # Keep monitoring for a bit
  Write-Host "📈 Monitoring server performance for 30 seconds..." -ForegroundColor Yellow
  Start-Sleep -Seconds 30

  # Final memory check
  $finalMemory = (Get-Process -Id $process.Id).WorkingSet / 1MB
  Write-Host "💾 Final memory usage: $([math]::Round($finalMemory, 2)) MB" -ForegroundColor Cyan

  # Stop the server
  Stop-Process -Id $process.Id -Force
  Write-Host "🛑 Server stopped" -ForegroundColor Yellow

}
elseif ($Optimize) {
  Write-Host "⚡ Optimizing startup performance..." -ForegroundColor Yellow

  # Optimize Node.js settings
  $env:NODE_OPTIONS = "--max-old-space-size=4096"
  Write-Host "✅ Set Node.js memory limit to 4GB" -ForegroundColor Green

  # Clear various caches
  Write-Host "🧹 Clearing caches..." -ForegroundColor Yellow

  if (Test-Path ".nuxt") {
    Remove-Item ".nuxt" -Recurse -Force
    Write-Host "✅ Cleared .nuxt cache" -ForegroundColor Green
  }

  if (Test-Path "node_modules/.cache") {
    Remove-Item "node_modules/.cache" -Recurse -Force
    Write-Host "✅ Cleared node_modules cache" -ForegroundColor Green
  }

  # Optimize package manager
  Write-Host "📦 Optimizing package manager..." -ForegroundColor Yellow
  pnpm store prune
  Write-Host "✅ Pruned package store" -ForegroundColor Green

  # Pre-warm dependencies
  Write-Host "🔥 Pre-warming dependencies..." -ForegroundColor Yellow
  npm run build --silent
  Write-Host "✅ Dependencies pre-warmed" -ForegroundColor Green

  Write-Host "✅ Optimization complete!" -ForegroundColor Green

}
elseif ($Cleanup) {
  Write-Host "🧹 Cleaning up..." -ForegroundColor Yellow

  # Stop all Node.js processes
  Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
  Write-Host "✅ Stopped all Node.js processes" -ForegroundColor Green

  # Clear caches
  if (Test-Path ".nuxt") {
    Remove-Item ".nuxt" -Recurse -Force
    Write-Host "✅ Cleared .nuxt cache" -ForegroundColor Green
  }

  if (Test-Path "node_modules/.cache") {
    Remove-Item "node_modules/.cache" -Recurse -Force
    Write-Host "✅ Cleared node_modules cache" -ForegroundColor Green
  }

  # Clear npm cache
  npm cache clean --force
  Write-Host "✅ Cleared npm cache" -ForegroundColor Green

  # Clear pnpm cache
  pnpm store prune
  Write-Host "✅ Cleared pnpm cache" -ForegroundColor Green

  Write-Host "✅ Cleanup complete!" -ForegroundColor Green

}
else {
  Write-Host "Usage:" -ForegroundColor Yellow
  Write-Host "  .\optimize-startup.ps1 -Monitor    # Monitor startup performance" -ForegroundColor White
  Write-Host "  .\optimize-startup.ps1 -Optimize   # Optimize startup performance" -ForegroundColor White
  Write-Host "  .\optimize-startup.ps1 -Cleanup    # Clean up caches and processes" -ForegroundColor White
  Write-Host ""
  Write-Host "Examples:" -ForegroundColor Yellow
  Write-Host "  .\optimize-startup.ps1 -Monitor -Port 3001" -ForegroundColor White
  Write-Host "  .\optimize-startup.ps1 -Optimize" -ForegroundColor White
}
