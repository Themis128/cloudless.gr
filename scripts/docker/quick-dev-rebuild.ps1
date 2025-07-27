# Quick Development Rebuild Script - No prompts, immediate execution
# Rebuilds Docker dev image and deploys with hot-updates at 192.168.0.23:3000

Write-Host "🚀 Quick development rebuild starting..." -ForegroundColor Green
Write-Host "📍 Target: 192.168.0.23:3000" -ForegroundColor Cyan
Write-Host "🔥 Hot-updates enabled" -ForegroundColor Yellow

# Stop and remove containers
Write-Host "🛑 Stopping development containers..." -ForegroundColor Blue
docker-compose -f docker-compose.dev.yml down --remove-orphans

# Remove old development images
Write-Host "🗑️  Removing old development images..." -ForegroundColor Blue
docker images --filter "reference=cloudlessgr-app-dev*" --format "{{.ID}}" | ForEach-Object { docker rmi -f $_ }
docker image prune -f

# Build new development image with hot-updates
Write-Host "🔨 Building new development image with hot-updates..." -ForegroundColor Blue
docker-compose -f docker-compose.dev.yml build --no-cache app-dev

# Start development deployment
Write-Host "🚀 Starting development deployment..." -ForegroundColor Blue
docker-compose -f docker-compose.dev.yml up -d

Write-Host "✅ Development rebuild completed!" -ForegroundColor Green
Write-Host "🌐 Application available at: http://192.168.0.23:3000" -ForegroundColor Cyan
Write-Host "🔥 Hot-reload active on port 24678" -ForegroundColor Yellow

# Show status
Start-Sleep -Seconds 3
docker-compose -f docker-compose.dev.yml ps

Write-Host "`n📋 Quick Commands:" -ForegroundColor Cyan
Write-Host "  View logs: docker-compose -f docker-compose.dev.yml logs -f app-dev" -ForegroundColor Gray
Write-Host "  Access app: http://192.168.0.23:3000" -ForegroundColor Gray
Write-Host "  Hot-reload: http://192.168.0.23:24678" -ForegroundColor Gray
