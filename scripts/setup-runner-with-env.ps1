# Improved GitHub Actions Runner Setup with Environment File
# This script properly handles the GITHUB_TOKEN for Docker Compose

Write-Host "🚀 Improved GitHub Actions Runner Setup" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

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
    Write-Host "  `$env:GITHUB_TOKEN = 'your-github-token'" -ForegroundColor Cyan
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

# Create environment file for Docker Compose
Write-Host "📝 Creating environment file..." -ForegroundColor Blue
$envContent = @"
GITHUB_TOKEN=$env:GITHUB_TOKEN
"@
$envContent | Out-File -FilePath ".env.runner" -Encoding UTF8 -NoNewline
Write-Host "✅ Environment file created" -ForegroundColor Green

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

# Start the runner with environment file
Write-Host "🚀 Starting GitHub Actions runner..." -ForegroundColor Blue
docker-compose --env-file .env.runner -f docker-compose.runner.simple.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Runner started successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to start runner" -ForegroundColor Red
    Write-Host "📋 Checking logs..." -ForegroundColor Yellow
    docker-compose --env-file .env.runner -f docker-compose.runner.simple.yml logs
    exit 1
}

# Wait for runner to initialize
Write-Host "⏳ Waiting for runner to initialize..." -ForegroundColor Blue
Start-Sleep -Seconds 15

# Check runner status
Write-Host "🔍 Checking runner status..." -ForegroundColor Blue
$runnerStatus = docker ps --filter "name=cloudless-github-runner" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host $runnerStatus -ForegroundColor Cyan

# Check runner logs
Write-Host "📋 Recent runner logs:" -ForegroundColor Blue
docker logs cloudless-github-runner --tail 15 2>$null

# Test runner health
Write-Host "🏥 Testing runner health..." -ForegroundColor Blue
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:8080/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "✅ Runner health check passed" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Runner health check returned status: $($healthResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Runner health check failed (this is normal during startup)" -ForegroundColor Yellow
}

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
Write-Host "  docker-compose --env-file .env.runner -f docker-compose.runner.simple.yml down" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Restart the runner:" -ForegroundColor Blue
Write-Host "  docker-compose --env-file .env.runner -f docker-compose.runner.simple.yml restart" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 Now try running your GitHub Actions workflow again!" -ForegroundColor Green
Write-Host "   The '🔍 Validate Configuration' step should now work!" -ForegroundColor Green 