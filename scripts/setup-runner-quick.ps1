# Quick GitHub Actions Runner Setup
# This script helps you get the runner working immediately

Write-Host "🚀 Quick GitHub Actions Runner Setup" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Check if GITHUB_TOKEN is set
if (-not $env:GITHUB_TOKEN) {
    Write-Host "❌ GITHUB_TOKEN environment variable is not set!" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 To get a GitHub token:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://github.com/settings/tokens" -ForegroundColor Cyan
    Write-Host "  2. Click 'Generate new token (classic)'" -ForegroundColor Cyan
    Write-Host "  3. Select scopes: 'repo' and 'workflow'" -ForegroundColor Cyan
    Write-Host "  4. Copy the token" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 Set the token:" -ForegroundColor Yellow
    Write-Host "  `$env:GITHUB_TOKEN = 'your-token-here'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🔄 Then run this script again" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ GITHUB_TOKEN is set" -ForegroundColor Green

# Check if Docker is running
try {
    docker info > $null 2>&1
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again" -ForegroundColor Yellow
    exit 1
}

# Stop any existing runner
Write-Host "🛑 Stopping any existing runner..." -ForegroundColor Blue
docker-compose -f docker-compose.runner.simple.yml down 2>$null
docker stop cloudless-github-runner 2>$null
docker rm cloudless-github-runner 2>$null

# Create necessary directories
Write-Host "📁 Creating directories..." -ForegroundColor Blue
New-Item -ItemType Directory -Force -Path "runner-data" | Out-Null
New-Item -ItemType Directory -Force -Path "runner-cache" | Out-Null
New-Item -ItemType Directory -Force -Path "runner-logs" | Out-Null

# Start the runner
Write-Host "🚀 Starting GitHub Actions runner..." -ForegroundColor Blue
docker-compose -f docker-compose.runner.simple.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Runner started successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to start runner" -ForegroundColor Red
    exit 1
}

# Wait for runner to initialize
Write-Host "⏳ Waiting for runner to initialize..." -ForegroundColor Blue
Start-Sleep -Seconds 10

# Check runner status
Write-Host "🔍 Checking runner status..." -ForegroundColor Blue
$runnerStatus = docker ps --filter "name=cloudless-github-runner" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host $runnerStatus -ForegroundColor Cyan

# Check runner logs
Write-Host "📋 Recent runner logs:" -ForegroundColor Blue
docker logs cloudless-github-runner --tail 10 2>$null

Write-Host ""
Write-Host "🎉 Runner Setup Complete!" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Your GitHub Actions runner is now running" -ForegroundColor Green
Write-Host "✅ It will automatically pick up new workflow jobs" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Monitor the runner:" -ForegroundColor Blue
Write-Host "  • Status: docker ps --filter name=cloudless-github-runner" -ForegroundColor Cyan
Write-Host "  • Logs: docker logs -f cloudless-github-runner" -ForegroundColor Cyan
Write-Host "  • Health: curl http://localhost:8080/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "🛑 Stop the runner:" -ForegroundColor Blue
Write-Host "  docker-compose -f docker-compose.runner.simple.yml down" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 Now try running your GitHub Actions workflow again!" -ForegroundColor Green 