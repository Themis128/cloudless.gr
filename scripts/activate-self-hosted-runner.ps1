# PowerShell script to activate self-hosted GitHub Actions runner
# This bypasses GitHub Actions billing limits

Write-Host "🚀 Activating Self-Hosted GitHub Actions Runner" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "docker-compose.runner.yml")) {
    Write-Host "❌ Error: docker-compose.runner.yml not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Yellow
    exit 1
}

# Check if GitHub token is set
if (-not $env:GITHUB_TOKEN) {
    Write-Host "⚠️  Warning: GITHUB_TOKEN environment variable not set" -ForegroundColor Yellow
    Write-Host "You'll need to set it before starting the runner:" -ForegroundColor Yellow
    Write-Host "  `$env:GITHUB_TOKEN = 'your-github-token'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To get a token:" -ForegroundColor Yellow
    Write-Host "  1. Go to GitHub Settings > Developer settings > Personal access tokens" -ForegroundColor Cyan
    Write-Host "  2. Generate a new token with 'repo' and 'workflow' permissions" -ForegroundColor Cyan
    Write-Host "  3. Copy the token and set it as GITHUB_TOKEN" -ForegroundColor Cyan
    Write-Host ""
}

# Step 1: Switch to self-hosted workflow
Write-Host "📋 Step 1: Switching to self-hosted workflow..." -ForegroundColor Blue

if (Test-Path ".github/workflows/self-hosted-runner.yml") {
    # Backup existing workflow if it exists
    if (Test-Path ".github/workflows/complete-pipeline.yml") {
        Write-Host "  📦 Backing up existing workflow..." -ForegroundColor Yellow
        Copy-Item ".github/workflows/complete-pipeline.yml" ".github/workflows/complete-pipeline.yml.backup"
    }
    
    # Activate self-hosted workflow
    Write-Host "  🔄 Activating self-hosted workflow..." -ForegroundColor Yellow
    Copy-Item ".github/workflows/self-hosted-runner.yml" ".github/workflows/complete-pipeline.yml"
    Write-Host "  ✅ Self-hosted workflow activated!" -ForegroundColor Green
} else {
    Write-Host "  ❌ Self-hosted workflow not found!" -ForegroundColor Red
    Write-Host "  Please ensure .github/workflows/self-hosted-runner.yml exists" -ForegroundColor Yellow
    exit 1
}

# Step 2: Start the Docker runner
Write-Host ""
Write-Host "🐳 Step 2: Starting Docker runner..." -ForegroundColor Blue

try {
    Write-Host "  🚀 Starting GitHub Actions runner container..." -ForegroundColor Yellow
    docker-compose -f docker-compose.runner.yml up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Docker runner started successfully!" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Failed to start Docker runner!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Error starting Docker runner: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Check runner status
Write-Host ""
Write-Host "🔍 Step 3: Checking runner status..." -ForegroundColor Blue

Start-Sleep -Seconds 10  # Wait for runner to initialize

try {
    $runnerStatus = docker ps --filter "name=cloudless-github-runner" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    Write-Host "  📊 Runner Status:" -ForegroundColor Yellow
    Write-Host $runnerStatus -ForegroundColor Cyan
    
    # Check if runner is healthy
    $healthCheck = docker exec cloudless-github-runner curl -f http://localhost:8080/health 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Runner is healthy and ready!" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Runner health check failed, but container is running" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Could not check runner status: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 4: Show next steps
Write-Host ""
Write-Host "🎉 Self-Hosted Runner Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Benefits:" -ForegroundColor Green
Write-Host "  • No GitHub Actions billing limits" -ForegroundColor Cyan
Write-Host "  • Faster execution (no queue waiting)" -ForegroundColor Cyan
Write-Host "  • Full control over environment" -ForegroundColor Cyan
Write-Host "  • Better security (data stays on your machine)" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Blue
Write-Host "  1. Push a commit to trigger the self-hosted workflow" -ForegroundColor Yellow
Write-Host "  2. Monitor the runner logs: docker logs cloudless-github-runner" -ForegroundColor Yellow
Write-Host "  3. Check workflow status in GitHub Actions tab" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔧 Useful Commands:" -ForegroundColor Blue
Write-Host "  • View runner logs: docker logs -f cloudless-github-runner" -ForegroundColor Cyan
Write-Host "  • Stop runner: docker-compose -f docker-compose.runner.yml down" -ForegroundColor Cyan
Write-Host "  • Restart runner: docker-compose -f docker-compose.runner.yml restart" -ForegroundColor Cyan
Write-Host "  • Check runner status: docker ps --filter name=cloudless-github-runner" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Monitor GitHub Actions:" -ForegroundColor Blue
Write-Host "  • Go to: https://github.com/themis128/cloudless.gr/actions" -ForegroundColor Cyan
Write-Host "  • Look for jobs running on 'self-hosted' runners" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Troubleshooting:" -ForegroundColor Blue
Write-Host "  • If workflows don't start, check runner logs" -ForegroundColor Yellow
Write-Host "  • Ensure GITHUB_TOKEN has correct permissions" -ForegroundColor Yellow
Write-Host "  • Verify Docker is running and accessible" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎯 You're now using self-hosted runners - no more billing issues!" -ForegroundColor Green 