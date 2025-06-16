# ULTRA-FAST Supabase Reset and Startup Script v2
# Optimized for immediate startup with minimal cleanup
#
# Usage Examples:
#   .\scripts\reset-and-seed-v2.ps1              # Fast reset with seeding
#   .\scripts\reset-and-seed-v2.ps1 -SkipSeed   # Ultra-fast reset without seeding
#   .\scripts\reset-and-seed-v2.ps1 -Quick      # Super quick mode (minimal cleanup)
#   .\scripts\reset-and-seed-v2.ps1 -Force      # Skip all prompts

param(
    [switch]$SkipSeed,
    [switch]$DevMode,
    [switch]$Quick,
    [switch]$Force,
    [switch]$NoCleanup
)

Write-Host "⚡ ULTRA-FAST Supabase Reset and Startup Script v2" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Auto-force mode for speed
if ($Quick -or $NoCleanup) {
    $Force = $true
}

# Show configuration
Write-Host "⚡ Configuration:" -ForegroundColor Cyan
Write-Host "  • Skip Seeding: $($SkipSeed -eq $true)" -ForegroundColor White
Write-Host "  • Quick Mode: $($Quick -eq $true)" -ForegroundColor White
Write-Host "  • No Cleanup: $($NoCleanup -eq $true)" -ForegroundColor White
Write-Host "  • Development Mode: $($DevMode -eq $true)" -ForegroundColor White

if (-not $Force) {
    Write-Host ""
    $response = Read-Host "Continue with ultra-fast reset? (Y/n)"
    if ($response -eq 'n' -or $response -eq 'N') {
        Write-Host "❌ Operation cancelled" -ForegroundColor Red
        exit 0
    }
}

# Change to docker directory
$originalPath = Get-Location
$startTime = Get-Date
try {
    Set-Location "docker"
    Write-Host ""
    Write-Host "📍 Working in: $(Get-Location)" -ForegroundColor Cyan

    # PHASE 1: FAST CLEANUP
    if ($NoCleanup) {
        Write-Host "⏭️  Skipping cleanup - restarting containers only..." -ForegroundColor Yellow
    } elseif ($Quick) {
        Write-Host "⚡ QUICK MODE: Minimal cleanup..." -ForegroundColor Yellow
        
        # Just stop containers quickly
        docker compose down --timeout 5 2>$null
        
        # Remove specific problematic containers
        docker rm -f supabase-vector supabase_vector_docker 2>$null
        
        Write-Host "✅ Quick cleanup completed" -ForegroundColor Green
    } else {
        Write-Host "🛑 Fast cleanup: Stopping containers and removing volumes..." -ForegroundColor Yellow
        
        # Stop everything with short timeout
        docker compose down -v --remove-orphans --timeout 10 2>$null
        
        # Force remove problematic containers
        docker rm -f supabase-vector supabase_vector_docker 2>$null
        
        # Quick volume cleanup for this project only
        docker volume ls --filter "name=docker_" --format "{{.Name}}" | ForEach-Object {
            docker volume rm $_ 2>$null
        }
        
        Write-Host "✅ Fast cleanup completed" -ForegroundColor Green
    }

    # PHASE 2: IMMEDIATE STARTUP
    Write-Host ""
    Write-Host "🚀 IMMEDIATE STARTUP: Starting Supabase now..." -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    # Start containers immediately
    if ($DevMode) {
        Write-Host "🔧 Starting in development mode..." -ForegroundColor Cyan
        docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up -d --force-recreate
    } else {
        Write-Host "🏭 Starting production mode..." -ForegroundColor Cyan
        docker compose up -d --force-recreate
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start containers" -ForegroundColor Red
        Write-Host "Checking Docker logs..." -ForegroundColor Yellow
        docker compose logs --tail=20
        exit 1
    }

    Write-Host "✅ Containers started!" -ForegroundColor Green

    # PHASE 3: SMART HEALTH CHECK
    Write-Host ""
    Write-Host "⏳ Smart health check (max 60 seconds)..." -ForegroundColor Yellow
    
    $timeout = 60
    $elapsed = 0
    $healthy = $false
    
    do {
        Start-Sleep -Seconds 2
        $elapsed += 2
        
        # Check essential services
        $dbRunning = docker ps --filter "name=supabase_db" --filter "status=running" --quiet 2>$null
        $authRunning = docker ps --filter "name=supabase_auth" --filter "status=running" --quiet 2>$null
        $apiRunning = docker ps --filter "name=supabase_rest" --filter "status=running" --quiet 2>$null
        
        if ($dbRunning -and $authRunning -and $apiRunning) {
            # Test actual connectivity
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    $healthy = $true
                    Write-Host "✅ Services are healthy and responding!" -ForegroundColor Green
                    break
                }
            } catch {
                # Continue waiting
            }
        }
        
        # Progress indicator
        if (($elapsed % 10) -eq 0) {
            Write-Host "   Still waiting... ($elapsed/$timeout seconds)" -ForegroundColor Gray
        } else {
            Write-Host "." -NoNewline -ForegroundColor Gray
        }
        
    } while ($elapsed -lt $timeout)

    Write-Host ""
    
    if (-not $healthy -and $elapsed -ge $timeout) {
        Write-Host "⚠️  Timeout reached, but containers are running. Proceeding..." -ForegroundColor Yellow
        Write-Host "   You can check manually: http://localhost:54323" -ForegroundColor White
    }

    # PHASE 4: SHOW STATUS
    Write-Host ""
    Write-Host "📋 Current Status:" -ForegroundColor Cyan
    docker ps --filter "name=supabase_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    # PHASE 5: SEEDING (if requested)
    if (-not $SkipSeed) {
        Write-Host ""
        Write-Host "🌱 Database seeding..." -ForegroundColor Green
        
        # Return to root directory
        Set-Location ".."
        
        # Wait a bit more for database to be fully ready
        Write-Host "⏳ Ensuring database is ready for seeding..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        
        # Run seeding
        Write-Host "🚀 Running seed script..." -ForegroundColor Cyan
        node scripts/seed-database.js
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database seeding completed!" -ForegroundColor Green
        } else {
            Write-Host "❌ Seeding failed - you can retry manually:" -ForegroundColor Red
            Write-Host "  node scripts/seed-database.js" -ForegroundColor White
        }
    } else {
        Write-Host ""
        Write-Host "⏭️  Skipping seeding (fastest mode)" -ForegroundColor Yellow
    }

    # PHASE 6: FINAL SUMMARY
    Write-Host ""
    Write-Host "🎉 ULTRA-FAST RESET COMPLETE!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    # Count running containers
    $runningContainers = docker ps --filter "name=supabase_" --filter "status=running" --format "{{.Names}}" 2>$null
    if ($runningContainers) {
        $containerCount = ($runningContainers -split "`n" | Where-Object { $_.Trim() -ne "" }).Count
        Write-Host "✅ $containerCount Supabase containers running" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "🌐 Ready to use:" -ForegroundColor Cyan
    Write-Host "  • Supabase Studio: http://localhost:54323" -ForegroundColor White
    Write-Host "  • API Endpoint: http://localhost:8000" -ForegroundColor White
    Write-Host "  • Database: localhost:54322" -ForegroundColor White
    
    if (-not $SkipSeed) {
        Write-Host ""
        Write-Host "👥 Test Users Available:" -ForegroundColor Cyan
        Write-Host "  🛡️  baltzakis.themis@gmail.com (admin) - Password: TH!123789th!" -ForegroundColor Green
        Write-Host "  🛡️  john.doe@example.com (admin) - Password: AdminPass123!" -ForegroundColor Blue
        Write-Host "  👤 jane.smith@example.com (moderator) - Password: ModPass123!" -ForegroundColor Magenta
        Write-Host "  👤 bob.wilson@example.com (user) - Password: UserPass123!" -ForegroundColor Gray
    }
    
    $elapsed = (Get-Date) - $startTime
    Write-Host ""
    Write-Host "⏱️  Total time: $($elapsed.TotalSeconds.ToString('F1')) seconds" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Docker logs:" -ForegroundColor Yellow
    docker compose logs --tail=10
    exit 1
} finally {
    Set-Location $originalPath
}
