# INSTANT Supabase Startup - Absolutely Minimal Reset
# For when you just need Supabase running RIGHT NOW
#
# Usage:
#   .\scripts\instant-supabase.ps1           # Just get it running
#   .\scripts\instant-supabase.ps1 -Seed    # Get it running + seed data

param(
    [switch]$Seed,
    [switch]$Force
)

Write-Host "⚡ INSTANT SUPABASE STARTUP" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if (-not $Force) {
    Write-Host "This will restart Supabase immediately. Continue? (Y/n): " -NoNewline -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq 'n' -or $response -eq 'N') {
        exit 0
    }
}

$startTime = Get-Date
$originalPath = Get-Location

try {
    Set-Location "docker"
    
    Write-Host "🚀 Starting Supabase..." -ForegroundColor Cyan
    
    # Kill any problematic containers first
    docker rm -f supabase-vector supabase_vector_docker 2>$null
    
    # Quick restart
    docker compose down --timeout 5 2>$null
    docker compose up -d --force-recreate
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start" -ForegroundColor Red
        exit 1
    }
    
    # Quick health check
    Write-Host "⏳ Health check..." -ForegroundColor Yellow
    $timeout = 30
    $elapsed = 0
    
    do {
        Start-Sleep -Seconds 2
        $elapsed += 2
        
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Ready!" -ForegroundColor Green
                break
            }
        } catch { }
        
        if (($elapsed % 10) -eq 0) {
            Write-Host "   $elapsed/$timeout seconds..." -ForegroundColor Gray
        } else {
            Write-Host "." -NoNewline -ForegroundColor Gray
        }
        
    } while ($elapsed -lt $timeout)
    
    Write-Host ""
    
    # Seed if requested
    if ($Seed) {
        Write-Host "🌱 Seeding..." -ForegroundColor Green
        Set-Location ".."
        Start-Sleep -Seconds 3  # Brief pause for DB readiness
        node scripts/seed-database.js
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Seeded!" -ForegroundColor Green
        } else {
            Write-Host "❌ Seed failed" -ForegroundColor Red
        }
    }
    
    # Summary
    $elapsed = (Get-Date) - $startTime
    Write-Host ""
    Write-Host "🎉 READY IN $($elapsed.TotalSeconds.ToString('F1'))s!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "🌐 Studio: http://localhost:54323" -ForegroundColor Cyan
    Write-Host "🌐 API: http://localhost:8000" -ForegroundColor Cyan
    
    if ($Seed) {
        Write-Host "👤 Test admin: baltzakis.themis@gmail.com / TH!123789th!" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Set-Location $originalPath
}
