# PowerShell script to restart Supabase with custom JWT keys and remove old Docker images
# Usage: .\scripts\apply-custom-keys.ps1

Write-Host "🔐 Applying Custom JWT Keys to Supabase" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Display the keys that will be applied
Write-Host "🔑 Custom Keys:" -ForegroundColor Cyan
Write-Host "  JWT Secret: eOvlpJPRGfQkptMLRFSfCPerPR5MkrekkpIuLqXd" -ForegroundColor White
Write-Host "  Anon Key: eyJh...fxQ (expires 2030-06-14)" -ForegroundColor White  
Write-Host "  Service Key: eyJh...Z6M (expires 2030-06-14)" -ForegroundColor White
Write-Host ""

# Check if Docker containers are running
Write-Host "🔍 Checking current container status..." -ForegroundColor Cyan
$containers = docker ps --filter "name=supabase_" --format "{{.Names}}" 2>$null

if ($containers) {
    Write-Host "📋 Found running containers:" -ForegroundColor Yellow
    $containers | ForEach-Object { Write-Host "  • $_" -ForegroundColor Gray }
    Write-Host ""
    
    Write-Host "🛑 Stopping containers to apply new keys..." -ForegroundColor Yellow
    Set-Location "docker"
    docker compose down

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Containers stopped successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Warning: Some containers may not have stopped cleanly" -ForegroundColor Yellow
    }

    # 🧹 NEW: Remove unused Docker images
    Write-Host "🧹 Cleaning up unused Docker images..." -ForegroundColor Cyan
    docker image prune -a -f

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker images removed successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Failed to remove images (check Docker permissions)" -ForegroundColor Yellow
    }
} else {
    Write-Host "ℹ️  No Supabase containers currently running" -ForegroundColor Blue
    Set-Location "docker"
}

# Start containers with new configuration
Write-Host "🚀 Starting containers with custom keys..." -ForegroundColor Green
docker compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Containers started successfully!" -ForegroundColor Green
    
    # Wait for services to be ready
    Write-Host "⏳ Waiting for services to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    # Go back to root directory for verification
    Set-Location ".."
    
    # Run verification
    Write-Host "🔍 Verifying custom keys configuration..." -ForegroundColor Cyan
    node scripts/verify-jwt-keys.js
    
    Write-Host ""
    Write-Host "🎉 Custom JWT Keys Applied!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "🌐 Access Points:" -ForegroundColor Cyan
    Write-Host "  • Supabase Studio: http://localhost:54323" -ForegroundColor White
    Write-Host "  • API Endpoint: http://localhost:8000" -ForegroundColor White
    Write-Host "  • Database: localhost:54322" -ForegroundColor White
    
    Write-Host ""
    Write-Host "🔐 Your Supabase instance now uses custom JWT keys!" -ForegroundColor Green
    Write-Host "These keys will persist across container restarts." -ForegroundColor White
} else {
    Write-Host "❌ Failed to start containers!" -ForegroundColor Red
    Write-Host "Check Docker logs for errors." -ForegroundColor Yellow
    exit 1
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
