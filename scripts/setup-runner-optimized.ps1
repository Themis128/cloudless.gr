# 🚀 Optimized Self-Hosted GitHub Actions Runner Setup
# Enhanced for performance, reliability, and resource efficiency

param(
    [string]$RunnerName = "cloudless-optimized-runner",
    [string]$RunnerLabels = "windows,docker,dev,self-hosted,optimized",
    [int]$MemoryLimit = 4,
    [int]$CpuLimit = 2,
    [switch]$SkipValidation = $false,
    [switch]$ForceReinstall = $false
)

Write-Host "🚀 Optimized Self-Hosted GitHub Actions Runner Setup" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""

# Configuration
$RunnerDir = ".\github-runner-optimized"
$CacheDir = ".\runner-cache"
$DataDir = ".\runner-data"
$LogsDir = ".\runner-logs"
$DockerComposeFile = "docker-compose.runner.optimized.yml"

# Function to check prerequisites
function Test-Prerequisites {
    Write-Host "🔍 Checking prerequisites..." -ForegroundColor Blue
    
    # Check if GITHUB_TOKEN is set
    if (-not $env:GITHUB_TOKEN) {
        Write-Host "❌ GITHUB_TOKEN environment variable is not set!" -ForegroundColor Red
        Write-Host "Please set it with: `$env:GITHUB_TOKEN = 'your-token-here'" -ForegroundColor Yellow
        Write-Host "Or add it to your PowerShell profile for persistence" -ForegroundColor Yellow
        return $false
    }
    Write-Host "✅ GITHUB_TOKEN is set" -ForegroundColor Green

    # Check if Docker is running
    try {
        docker version | Out-Null
        Write-Host "✅ Docker is running" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker is not running or not installed!" -ForegroundColor Red
        Write-Host "Please start Docker Desktop and try again" -ForegroundColor Yellow
        return $false
    }

    # Check Docker resources
    try {
        $dockerInfo = docker system info --format "{{.NCPU}} {{.MemTotal}}"
        $cpuCount, $memoryBytes = $dockerInfo -split " "
        $memoryGB = [math]::Round([long]$memoryBytes / 1GB, 1)
        
        Write-Host "📊 Docker Resources:" -ForegroundColor Cyan
        Write-Host "  • CPUs: $cpuCount" -ForegroundColor White
        Write-Host "  • Memory: ${memoryGB}GB" -ForegroundColor White
        
        if ([int]$cpuCount -lt $CpuLimit) {
            Write-Host "⚠️ Warning: CPU limit ($CpuLimit) exceeds available CPUs ($cpuCount)" -ForegroundColor Yellow
        }
        if ($memoryGB -lt $MemoryLimit) {
            Write-Host "⚠️ Warning: Memory limit (${MemoryLimit}GB) exceeds available memory (${memoryGB}GB)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️ Could not check Docker resources" -ForegroundColor Yellow
    }

    return $true
}

# Function to create optimized directory structure
function New-OptimizedDirectories {
    Write-Host "📁 Creating optimized directory structure..." -ForegroundColor Blue
    
    $directories = @(
        $RunnerDir,
        "$CacheDir\npm",
        "$CacheDir\docker", 
        "$CacheDir\nuxt",
        "$CacheDir\playwright",
        "$CacheDir\build",
        $DataDir,
        $LogsDir
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "  ✅ Created: $dir" -ForegroundColor Green
        } else {
            Write-Host "  ℹ️ Exists: $dir" -ForegroundColor Gray
        }
    }
}

# Function to validate GitHub token and repository access
function Test-GitHubAccess {
    Write-Host "🔐 Validating GitHub access..." -ForegroundColor Blue
    
    try {
        $headers = @{
            "Authorization" = "token $env:GITHUB_TOKEN"
            "Accept" = "application/vnd.github.v3+json"
        }
        
        # Test repository access
        $repoUrl = "https://api.github.com/repos/Themis128/cloudless.gr"
        $response = Invoke-RestMethod -Uri $repoUrl -Headers $headers -Method Get
        
        Write-Host "✅ Repository access verified: $($response.full_name)" -ForegroundColor Green
        
        # Test runner registration permission
        $runnerUrl = "https://api.github.com/repos/Themis128/cloudless.gr/actions/runners/registration-token"
        $tokenResponse = Invoke-RestMethod -Uri $runnerUrl -Headers $headers -Method Post
        
        Write-Host "✅ Runner registration permission verified" -ForegroundColor Green
        return $true
        
    } catch {
        Write-Host "❌ GitHub access validation failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Make sure your GITHUB_TOKEN has the 'actions' permission" -ForegroundColor Yellow
        return $false
    }
}

# Function to create optimized environment file
function New-OptimizedEnvFile {
    Write-Host "⚙️ Creating optimized environment file..." -ForegroundColor Blue
    
    $envContent = @"
# Optimized GitHub Actions Runner Environment
# Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Core Configuration
GITHUB_TOKEN=$env:GITHUB_TOKEN
RUNNER_NAME=$RunnerName
RUNNER_LABELS=$RunnerLabels

# Performance Optimizations
NODE_OPTIONS=--max-old-space-size=4096
NPM_CONFIG_CACHE=/cache/npm
NPM_CONFIG_PREFER_OFFLINE=true
NPM_CONFIG_LOGLEVEL=warn

# Docker Optimizations
DOCKER_BUILDKIT=1
DOCKER_CLI_EXPERIMENTAL=enabled
BUILDKIT_PROGRESS=plain
BUILDKIT_INLINE_CACHE=1

# Cache Configuration
CACHE_DIR=/cache
BUILD_CACHE_DIR=/build-cache

# Resource Limits
MEMORY_LIMIT=${MemoryLimit}G
CPU_LIMIT=$CpuLimit

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
"@

    $envContent | Out-File -FilePath ".env.runner" -Encoding UTF8
    Write-Host "✅ Environment file created: .env.runner" -ForegroundColor Green
}

# Function to stop existing runners
function Stop-ExistingRunners {
    Write-Host "🛑 Stopping existing runners..." -ForegroundColor Blue
    
    # Stop Docker Compose services
    if (Test-Path $DockerComposeFile) {
        try {
            docker-compose -f $DockerComposeFile down --remove-orphans
            Write-Host "✅ Stopped Docker Compose services" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Could not stop Docker Compose services: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    
    # Stop any running runner containers
    try {
        $runningContainers = docker ps --filter "name=cloudless-github-runner" --format "{{.Names}}"
        if ($runningContainers) {
            docker stop $runningContainers
            docker rm $runningContainers
            Write-Host "✅ Stopped existing runner containers" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️ Could not stop existing containers: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Function to start optimized runner
function Start-OptimizedRunner {
    Write-Host "🚀 Starting optimized runner..." -ForegroundColor Blue
    
    try {
        # Start the runner with Docker Compose
        docker-compose -f $DockerComposeFile up -d
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Optimized runner started successfully!" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to start optimized runner" -ForegroundColor Red
            return $false
        }
        
        # Wait for runner to be ready
        Write-Host "⏳ Waiting for runner to be ready..." -ForegroundColor Blue
        $maxAttempts = 30
        $attempt = 0
        
        while ($attempt -lt $maxAttempts) {
            $attempt++
            try {
                $healthResponse = Invoke-WebRequest -Uri "http://localhost:8080/health" -TimeoutSec 5 -ErrorAction Stop
                if ($healthResponse.StatusCode -eq 200) {
                    Write-Host "✅ Runner is healthy and ready!" -ForegroundColor Green
                    break
                }
            } catch {
                if ($attempt -eq $maxAttempts) {
                    Write-Host "❌ Runner failed to become ready within timeout" -ForegroundColor Red
                    return $false
                }
                Write-Host "⏳ Waiting... ($attempt/$maxAttempts)" -ForegroundColor Yellow
                Start-Sleep -Seconds 2
            }
        }
        
        return $true
        
    } catch {
        Write-Host "❌ Failed to start optimized runner: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to display runner status
function Show-RunnerStatus {
    Write-Host ""
    Write-Host "📊 Optimized Runner Status" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan
    
    # Container status
    try {
        $containerStatus = docker ps --filter "name=cloudless-github-runner" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        Write-Host "🐳 Container Status:" -ForegroundColor White
        Write-Host $containerStatus -ForegroundColor Gray
    } catch {
        Write-Host "⚠️ Could not get container status" -ForegroundColor Yellow
    }
    
    # Resource usage
    try {
        $stats = docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
        Write-Host ""
        Write-Host "📈 Resource Usage:" -ForegroundColor White
        Write-Host $stats -ForegroundColor Gray
    } catch {
        Write-Host "⚠️ Could not get resource usage" -ForegroundColor Yellow
    }
    
    # Cache status
    try {
        Write-Host ""
        Write-Host "💾 Cache Status:" -ForegroundColor White
        Get-ChildItem $CacheDir -Directory | ForEach-Object {
            $size = (Get-ChildItem $_.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum
            $sizeMB = [math]::Round($size / 1MB, 2)
            Write-Host "  • $($_.Name): ${sizeMB}MB" -ForegroundColor Gray
        }
    } catch {
        Write-Host "⚠️ Could not get cache status" -ForegroundColor Yellow
    }
}

# Function to display management commands
function Show-ManagementCommands {
    Write-Host ""
    Write-Host "🔧 Management Commands" -ForegroundColor Cyan
    Write-Host "=====================" -ForegroundColor Cyan
    Write-Host "  • View logs: docker logs -f cloudless-github-runner-optimized" -ForegroundColor White
    Write-Host "  • Stop runner: docker-compose -f $DockerComposeFile down" -ForegroundColor White
    Write-Host "  • Restart runner: docker-compose -f $DockerComposeFile restart" -ForegroundColor White
    Write-Host "  • Check health: curl http://localhost:8080/health" -ForegroundColor White
    Write-Host "  • View stats: docker stats cloudless-github-runner-optimized" -ForegroundColor White
    Write-Host "  • Clean cache: Remove-Item -Recurse -Force $CacheDir\*" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Useful URLs:" -ForegroundColor Cyan
    Write-Host "  • Health Check: http://localhost:8080/health" -ForegroundColor White
    Write-Host "  • GitHub Actions: https://github.com/Themis128/cloudless.gr/actions" -ForegroundColor White
    Write-Host ""
    Write-Host "✅ Optimized runner setup complete! 🎉" -ForegroundColor Green
}

# Main execution
try {
    # Check prerequisites
    if (-not (Test-Prerequisites)) {
        exit 1
    }
    
    # Validate GitHub access (unless skipped)
    if (-not $SkipValidation) {
        if (-not (Test-GitHubAccess)) {
            exit 1
        }
    }
    
    # Stop existing runners (unless force reinstall)
    if (-not $ForceReinstall) {
        Stop-ExistingRunners
    }
    
    # Create optimized directories
    New-OptimizedDirectories
    
    # Create optimized environment file
    New-OptimizedEnvFile
    
    # Start optimized runner
    if (Start-OptimizedRunner) {
        # Show status and management commands
        Show-RunnerStatus
        Show-ManagementCommands
    } else {
        Write-Host "❌ Failed to start optimized runner" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "❌ Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} 