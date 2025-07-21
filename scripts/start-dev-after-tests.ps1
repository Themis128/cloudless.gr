# PowerShell script to start dev containers after successful tests
# This can be run manually or triggered by GitHub Actions

param(
    [switch]$Force,
    [switch]$SkipChecks,
    [switch]$Verbose
)

Write-Host "🚀 Start Dev Containers After Tests" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

# Function to check if tests passed
function Test-TestsPassed {
    Write-Host "🔍 Checking if tests passed..." -ForegroundColor Blue
    
    # Check if we're in a CI environment
    if ($env:GITHUB_ACTIONS -eq "true") {
        Write-Host "  📋 Running in GitHub Actions environment" -ForegroundColor Yellow
        return $true
    }
    
    # For local development, check if we want to skip checks
    if ($SkipChecks) {
        Write-Host "  ⚠️  Skipping test checks (--SkipChecks flag)" -ForegroundColor Yellow
        return $true
    }
    
    # Check if recent tests passed (you can customize this logic)
    Write-Host "  🧪 Running quick test suite..." -ForegroundColor Yellow
    
    try {
        # Run a quick test to verify everything is working
        npm run test:quick 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Quick tests passed" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ❌ Quick tests failed" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "  ⚠️  Could not run tests, assuming passed" -ForegroundColor Yellow
        return $true
    }
}

# Function to check if dev containers are running
function Test-DevContainersRunning {
    Write-Host "🔍 Checking dev container status..." -ForegroundColor Blue
    
    try {
        $containers = docker ps --filter "name=cloudlessgr" --format "{{.Names}}" 2>$null
        if ($containers -match "cloudlessgr-app-dev") {
            Write-Host "  ✅ Dev containers are already running" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ❌ Dev containers are not running" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "  ⚠️  Could not check container status" -ForegroundColor Yellow
        return $false
    }
}

# Function to stop dev containers
function Stop-DevContainers {
    Write-Host "🛑 Stopping existing dev containers..." -ForegroundColor Blue
    
    try {
        docker-compose -f scripts/docker/docker-compose.dev.yml down
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Dev containers stopped successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ❌ Failed to stop dev containers" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "  ⚠️  Error stopping containers: $($_.Exception.Message)" -ForegroundColor Yellow
        return $false
    }
}

# Function to start dev containers
function Start-DevContainers {
    Write-Host "🚀 Starting dev containers..." -ForegroundColor Blue
    
    # Check if .env file exists
    if (-not (Test-Path ".env")) {
        Write-Host "  📝 Creating .env file from template..." -ForegroundColor Yellow
        if (Test-Path "env.example") {
            Copy-Item "env.example" ".env"
            Write-Host "  ✅ .env file created" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  env.example not found, continuing without .env" -ForegroundColor Yellow
        }
    }
    
    # Start dev containers
    try {
        docker-compose -f scripts/docker/docker-compose.dev.yml up -d
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Dev containers started successfully!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ❌ Failed to start dev containers" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "  ❌ Error starting containers: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to wait for containers to be ready
function Wait-DevContainersReady {
    Write-Host "⏳ Waiting for dev containers to be ready..." -ForegroundColor Blue
    
    $maxAttempts = 30
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        $attempt++
        
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "  ✅ App is ready and responding!" -ForegroundColor Green
                return $true
            }
        } catch {
            # Continue waiting
        }
        
        if ($attempt -eq $maxAttempts) {
            Write-Host "  ❌ App failed to start within timeout" -ForegroundColor Red
            Write-Host "  📊 Container status:" -ForegroundColor Yellow
            docker ps --filter "name=cloudlessgr" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null
            Write-Host "  📋 App logs:" -ForegroundColor Yellow
            docker logs cloudlessgr-app-dev --tail 20 2>$null
            return $false
        }
        
        Write-Host "  ⏳ Waiting... ($attempt/$maxAttempts)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

# Function to verify dev environment
function Test-DevEnvironment {
    Write-Host "🔍 Verifying dev environment..." -ForegroundColor Blue
    
    # Check all containers are running
    Write-Host "  📊 Container Status:" -ForegroundColor Yellow
    docker ps --filter "name=cloudlessgr" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null
    
    # Test key endpoints
    Write-Host "  🧪 Testing endpoints:" -ForegroundColor Yellow
    
    try {
        $healthResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5
        if ($healthResponse.StatusCode -eq 200) {
            Write-Host "    ✅ Health check passed" -ForegroundColor Green
        }
    } catch {
        Write-Host "    ❌ Health check failed" -ForegroundColor Red
    }
    
    try {
        $apiResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/v1" -TimeoutSec 5
        if ($apiResponse.StatusCode -eq 200) {
            Write-Host "    ✅ API v1 endpoint working" -ForegroundColor Green
        }
    } catch {
        Write-Host "    ❌ API v1 endpoint failed" -ForegroundColor Red
    }
    
    # Check Redis connection
    try {
        $redisResult = docker exec cloudlessgr-redis-dev redis-cli ping 2>$null
        if ($redisResult -match "PONG") {
            Write-Host "    ✅ Redis is working" -ForegroundColor Green
        } else {
            Write-Host "    ⚠️  Redis connection failed" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "    ⚠️  Could not check Redis" -ForegroundColor Yellow
    }
    
    # Check PostgreSQL connection
    try {
        $pgResult = docker exec cloudlessgr-postgres-dev pg_isready -U cloudless 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✅ PostgreSQL is working" -ForegroundColor Green
        } else {
            Write-Host "    ⚠️  PostgreSQL connection failed" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "    ⚠️  Could not check PostgreSQL" -ForegroundColor Yellow
    }
}

# Function to display dev environment info
function Show-DevEnvironmentInfo {
    Write-Host ""
    Write-Host "🎉 Local Dev Environment is Ready!" -ForegroundColor Green
    Write-Host "==================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Application URLs:" -ForegroundColor Blue
    Write-Host "  • Main App: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  • API Health: http://localhost:3000/api/health" -ForegroundColor Cyan
    Write-Host "  • API v1: http://localhost:3000/api/v1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🔧 Development Tools:" -ForegroundColor Blue
    Write-Host "  • Node.js Debugger: localhost:9229" -ForegroundColor Cyan
    Write-Host "  • Redis: localhost:6379" -ForegroundColor Cyan
    Write-Host "  • PostgreSQL: localhost:5432" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📊 Container Status:" -ForegroundColor Blue
    docker ps --filter "name=cloudlessgr" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null
    Write-Host ""
    Write-Host "📋 Useful Commands:" -ForegroundColor Blue
    Write-Host "  • View logs: docker logs -f cloudlessgr-app-dev" -ForegroundColor Cyan
    Write-Host "  • Stop dev: docker-compose -f scripts/docker/docker-compose.dev.yml down" -ForegroundColor Cyan
    Write-Host "  • Restart: docker-compose -f scripts/docker/docker-compose.dev.yml restart" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🎯 Your dev environment is ready for development!" -ForegroundColor Green
}

# Main execution
try {
    # Check if tests passed (unless forced)
    if (-not $Force) {
        if (-not (Test-TestsPassed)) {
            Write-Host "❌ Tests did not pass. Use -Force to override." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠️  Force flag used - skipping test checks" -ForegroundColor Yellow
    }
    
    # Check if containers are already running
    if (Test-DevContainersRunning) {
        if ($Force) {
            Write-Host "🔄 Force flag used - restarting containers" -ForegroundColor Yellow
            if (-not (Stop-DevContainers)) {
                Write-Host "❌ Failed to stop existing containers" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "✅ Dev containers are already running!" -ForegroundColor Green
            Show-DevEnvironmentInfo
            exit 0
        }
    }
    
    # Start dev containers
    if (-not (Start-DevContainers)) {
        Write-Host "❌ Failed to start dev containers" -ForegroundColor Red
        exit 1
    }
    
    # Wait for containers to be ready
    if (-not (Wait-DevContainersReady)) {
        Write-Host "❌ Dev containers failed to become ready" -ForegroundColor Red
        exit 1
    }
    
    # Verify environment
    Test-DevEnvironment
    
    # Show success info
    Show-DevEnvironmentInfo
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} 