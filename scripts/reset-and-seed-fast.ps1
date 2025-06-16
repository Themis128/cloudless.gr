# FAST Supabase Reset and Startup Script
# This script gets Supabase running immediately with minimal cleanup
#
# Usage Examples:
#   .\scripts\reset-and-seed.ps1                    # Full reset with seeding (FAST)
#   .\scripts\reset-and-seed.ps1 -SkipSeed         # Reset without seeding (FASTEST)
#   .\scripts\reset-and-seed.ps1 -DevMode          # Development mode
#   .\scripts\reset-and-seed.ps1 -Quick            # Super quick mode (minimal cleanup)
#   .\scripts\reset-and-seed.ps1 -Force            # Skip all prompts
#
# Parameters:
#   -SkipSeed     : Skip database seeding after reset
#   -DevMode      : Use development compose file
#   -Quick        : Minimal cleanup for fastest startup
#   -Force        : Skip confirmation prompts
#   -NoCleanup    : Skip all cleanup steps (restart only)

param(
    [switch]$SkipSeed,
    [switch]$DevMode,
    [switch]$Quick,
    [switch]$Force,
    [switch]$NoCleanup
)

Write-Host "🚀 FAST Supabase Reset and Startup Script" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Auto-force mode for speed
if ($Quick -or $NoCleanup) {
    $Force = $true
}

# Show configuration
Write-Host "⚡ Fast Mode Configuration:" -ForegroundColor Cyan
Write-Host "  • Development Mode: $($DevMode)" -ForegroundColor White
Write-Host "  • Skip Seeding: $($SkipSeed)" -ForegroundColor White
Write-Host "  • Quick Mode: $($Quick)" -ForegroundColor White
Write-Host "  • No Cleanup: $($NoCleanup)" -ForegroundColor White

if (-not $Force) {
    Write-Host ""
    Write-Host "⚠️  This will reset Supabase for immediate startup" -ForegroundColor Yellow
    $response = Read-Host "Continue? (Y/n)"
    if ($response -eq 'n' -or $response -eq 'N') {
        Write-Host "❌ Operation cancelled" -ForegroundColor Red
        exit 0
    }
}

$startTime = Get-Date
Write-Host ""

# Change to docker directory
$originalPath = Get-Location
try {
    Set-Location "docker"
    Write-Host "📍 Working in: $(Get-Location)" -ForegroundColor Cyan

    # FAST CLEANUP
    if ($NoCleanup) {
        Write-Host "⏭️  Skipping cleanup - restarting containers only..." -ForegroundColor Yellow
    } elseif ($Quick) {
        Write-Host "⚡ QUICK MODE: Minimal cleanup..." -ForegroundColor Yellow
        docker compose down 2>$null
        docker rm -f supabase-vector supabase_vector_docker 2>$null
        Write-Host "✅ Quick cleanup done" -ForegroundColor Green
    } else {
        Write-Host "🛑 Fast cleanup: Stopping containers..." -ForegroundColor Yellow
        if ($DevMode) {
            docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml down -v --remove-orphans 2>$null
        } else {
            docker compose down -v --remove-orphans 2>$null
        }
        docker rm -f supabase-vector supabase_vector_docker 2>$null
        Write-Host "✅ Fast cleanup done" -ForegroundColor Green
    }

    # IMMEDIATE STARTUP
    Write-Host ""
    Write-Host "🚀 STARTING SUPABASE NOW..." -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    if ($DevMode) {
        Write-Host "🔧 Development mode startup..." -ForegroundColor Cyan
        docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up -d
    } else {
        Write-Host "🏭 Production mode startup..." -ForegroundColor Cyan
        docker compose up -d
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start containers" -ForegroundColor Red
        exit 1
    }

    Write-Host "✅ Containers started!" -ForegroundColor Green

    # FAST HEALTH CHECK
    Write-Host ""
    Write-Host "⏳ Quick health check..." -ForegroundColor Yellow
    
    $maxWait = 60
    $waited = 0
    
    do {
        Start-Sleep -Seconds 2
        $waited += 2
        
        $dbStatus = docker ps --filter "name=supabase_db_docker" --filter "status=running" --format "{{.Status}}" 2>$null
        $authStatus = docker ps --filter "name=supabase_auth_docker" --filter "status=running" --format "{{.Status}}" 2>$null
        
        if ($dbStatus -and $authStatus) {
            Write-Host "✅ Core services are running!" -ForegroundColor Green
            break
        }
        
        Write-Host "." -NoNewline -ForegroundColor Gray
        
    } while ($waited -lt $maxWait)

    if ($waited -ge $maxWait) {
        Write-Host ""
        Write-Host "⚠️  Services are starting... (may take a bit longer)" -ForegroundColor Yellow
    }

    # SHOW STATUS
    Write-Host ""
    Write-Host "📋 Container Status:" -ForegroundColor Cyan
    docker ps --filter "name=supabase_" --format "table {{.Names}}\t{{.Status}}" 2>$null

    # FAST SEEDING
    if (-not $SkipSeed) {
        Write-Host ""
        Write-Host "🌱 Fast database seeding..." -ForegroundColor Green
        
        Set-Location ".."
        
        # Quick seeding with timeout
        $seedJob = Start-Job -ScriptBlock {
            node scripts/seed-database.js
        }
        
        if (Wait-Job $seedJob -Timeout 120) {
            $seedResult = Receive-Job $seedJob
            Write-Host $seedResult
            Write-Host "✅ Seeding completed!" -ForegroundColor Green
        } else {
            Stop-Job $seedJob
            Write-Host "⚠️  Seeding timeout - continuing anyway" -ForegroundColor Yellow
            Write-Host "You can run seeding manually: node scripts/seed-database.js" -ForegroundColor Gray
        }
        
        Remove-Job $seedJob -Force 2>$null
        Set-Location "docker"
    }

    # FINAL SUMMARY
    $endTime = Get-Date
    $totalTime = [math]::Round(($endTime - $startTime).TotalSeconds, 1)
    
    Write-Host ""
    Write-Host "🎉 SUPABASE IS READY!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "⏱️  Total time: $totalTime seconds" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🌐 Access Points:" -ForegroundColor Cyan
    Write-Host "  • Supabase Studio: http://localhost:54323" -ForegroundColor White
    Write-Host "  • API Endpoint: http://localhost:8000" -ForegroundColor White
    Write-Host "  • Database: localhost:54322" -ForegroundColor White
    Write-Host "  • Email Testing: http://localhost:54324" -ForegroundColor White
    
    if (-not $SkipSeed) {
        Write-Host ""
        Write-Host "👥 Seeded Users:" -ForegroundColor Cyan
        Write-Host "  🛡️  baltzakis.themis@gmail.com (admin) - Password: TH!123789th!" -ForegroundColor Green
        Write-Host "  🛡️  john.doe@example.com (admin) - Password: AdminPass123!" -ForegroundColor Blue
        Write-Host "  🛂 jane.smith@example.com (moderator) - Password: ModPass123!" -ForegroundColor Magenta
        Write-Host "  👤 bob.wilson@example.com (user) - Password: UserPass123!" -ForegroundColor Gray
        Write-Host "  👤 alice.johnson@example.com (user) - Password: UserPass123!" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "💡 Quick Commands:" -ForegroundColor Cyan
    Write-Host "  • Check status: docker ps" -ForegroundColor White
    Write-Host "  • View logs: docker compose logs" -ForegroundColor White
    Write-Host "  • Stop all: docker compose down" -ForegroundColor White
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Set-Location $originalPath
}
