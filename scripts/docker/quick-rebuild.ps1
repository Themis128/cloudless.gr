# Quick Rebuild Script - No prompts, immediate execution
# Rebuilds Docker image and deploys with network address 192.168.0.23:3000

Write-Host "🚀 Quick rebuild starting..." -ForegroundColor Green
Write-Host "📍 Target: 192.168.0.23:3000" -ForegroundColor Cyan

# Stop and remove containers
Write-Host "🛑 Stopping containers..." -ForegroundColor Blue
docker-compose -f docker-compose.dev.yml down --remove-orphans

# Remove old images
Write-Host "🗑️  Removing old images..." -ForegroundColor Blue
docker images --filter "reference=cloudlessgr-app*" --format "{{.ID}}" | ForEach-Object { docker rmi -f $_ }
docker image prune -f

# Build new image
Write-Host "🔨 Building new image..." -ForegroundColor Blue
docker-compose -f docker-compose.dev.yml build --no-cache app-dev

# Start deployment
Write-Host "🚀 Starting deployment..." -ForegroundColor Blue
docker-compose -f docker-compose.dev.yml up -d

Write-Host "✅ Rebuild completed!" -ForegroundColor Green
Write-Host "🌐 Application available at: http://192.168.0.23:3000" -ForegroundColor Cyan

# Show status
Start-Sleep -Seconds 3
docker-compose -f docker-compose.dev.yml ps
