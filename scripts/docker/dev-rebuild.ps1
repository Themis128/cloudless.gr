# Development Rebuild Script for Cloudless.gr
# Optimized for hot-updates and fast development cycles

param(
    [switch]$Force = $false,
    [switch]$SkipBackup = $false,
    [switch]$CleanCache = $false
)

Write-Host "🚀 Starting development rebuild for Cloudless.gr" -ForegroundColor Green
Write-Host "📍 Target Network Address: 192.168.0.23:3000" -ForegroundColor Cyan
Write-Host "🔥 Hot-updates enabled for fast development" -ForegroundColor Yellow

# Function to check if Docker is running
function Test-DockerRunning {
    try {
        docker version | Out-Null
        return $true
    }
    catch {
        Write-Host "❌ Docker is not running or not accessible" -ForegroundColor Red
        return $false
    }
}

# Function to clean development caches
function Clear-DevCaches {
    if ($CleanCache) {
        Write-Host "🧹 Cleaning development caches..." -ForegroundColor Blue

        # Remove local cache directories
        $cacheDirs = @(".nuxt", ".output", "dist", ".vite", ".esbuild", "coverage", "playwright-report")
        foreach ($dir in $cacheDirs) {
            if (Test-Path $dir) {
                Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
                Write-Host "  Removed: $dir" -ForegroundColor Gray
            }
        }

        # Clean Docker build cache
        docker builder prune -f
        Write-Host "✅ Development caches cleaned" -ForegroundColor Green
    }
}

# Function to create backup
function New-Backup {
    if ($SkipBackup) {
        Write-Host "⚠️  Skipping backup as requested" -ForegroundColor Yellow
        return
    }

    Write-Host "📦 Creating development backup..." -ForegroundColor Blue
    $backupDir = "db-backups/dev-$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

    try {
        # Backup database
        docker exec cloudlessgr-postgres-dev pg_dump -U cloudless cloudless_dev > "$backupDir/database_backup.sql"
        Write-Host "✅ Database backup created: $backupDir/database_backup.sql" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Could not create database backup: $_" -ForegroundColor Yellow
    }
}

# Function to stop development containers
function Stop-DevContainers {
    Write-Host "🛑 Stopping development containers..." -ForegroundColor Blue

    try {
        # Stop containers gracefully
        docker-compose -f docker-compose.dev.yml down --remove-orphans
        Write-Host "✅ Development containers stopped" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Error stopping containers: $_" -ForegroundColor Yellow
    }
}

# Function to remove old development images
function Remove-DevImages {
    Write-Host "🗑️  Removing old development images..." -ForegroundColor Blue

    try {
        # Remove old dev app images
        $oldImages = docker images --filter "reference=cloudlessgr-app-dev*" --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}"
        if ($oldImages) {
            Write-Host "Found old development images:" -ForegroundColor Yellow
            Write-Host $oldImages -ForegroundColor Gray

            # Remove images by ID
            $imageIds = docker images --filter "reference=cloudlessgr-app-dev*" --format "{{.ID}}"
            foreach ($id in $imageIds) {
                docker rmi -f $id
                Write-Host "Removed image: $id" -ForegroundColor Green
            }
        }

        # Clean up dangling images
        docker image prune -f
        Write-Host "✅ Old development images removed" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Error removing old images: $_" -ForegroundColor Yellow
    }
}

# Function to build new development image
function Build-DevImage {
    Write-Host "🔨 Building new development image with hot-updates..." -ForegroundColor Blue

    try {
        # Build with no cache for fresh development environment
        docker-compose -f docker-compose.dev.yml build --no-cache app-dev

        Write-Host "✅ Development image built successfully" -ForegroundColor Green
        Write-Host "🔥 Hot-updates configured for instant file changes" -ForegroundColor Cyan
    }
    catch {
        Write-Host "❌ Error building development image: $_" -ForegroundColor Red
        exit 1
    }
}

# Function to start development deployment
function Start-DevDeployment {
    Write-Host "🚀 Starting development deployment..." -ForegroundColor Blue

    try {
        # Start services in detached mode
        docker-compose -f docker-compose.dev.yml up -d

        Write-Host "✅ Development deployment started" -ForegroundColor Green
        Write-Host "🌐 Application available at: http://192.168.0.23:3000" -ForegroundColor Cyan
        Write-Host "🔥 Hot-reload active on port 24678" -ForegroundColor Yellow

        # Show container status
        Start-Sleep -Seconds 5
        docker-compose -f docker-compose.dev.yml ps
    }
    catch {
        Write-Host "❌ Error starting development deployment: $_" -ForegroundColor Red
        exit 1
    }
}

# Function to verify development deployment
function Test-DevDeployment {
    Write-Host "🔍 Verifying development deployment..." -ForegroundColor Blue

    $maxAttempts = 30
    $attempt = 0

    while ($attempt -lt $maxAttempts) {
        $attempt++
        Write-Host "Attempt $attempt/$maxAttempts - Checking development server..." -ForegroundColor Gray

        try {
            $response = Invoke-WebRequest -Uri "http://192.168.0.23:3000/api/health/simple" -TimeoutSec 10 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Development server is healthy and responding!" -ForegroundColor Green
                return $true
            }
        }
        catch {
            Write-Host "⏳ Development server starting up... (Attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
        }

        Start-Sleep -Seconds 10
    }

    Write-Host "⚠️  Development server may still be starting. Check logs with: docker-compose -f docker-compose.dev.yml logs -f app-dev" -ForegroundColor Yellow
    return $false
}

# Function to show development commands
function Show-DevCommands {
    Write-Host "`n📋 Development Commands:" -ForegroundColor Cyan
    Write-Host "  View logs: docker-compose -f docker-compose.dev.yml logs -f app-dev" -ForegroundColor Gray
    Write-Host "  Stop services: docker-compose -f docker-compose.dev.yml down" -ForegroundColor Gray
    Write-Host "  Restart app: docker-compose -f docker-compose.dev.yml restart app-dev" -ForegroundColor Gray
    Write-Host "  View containers: docker-compose -f docker-compose.dev.yml ps" -ForegroundColor Gray
    Write-Host "  Access app: http://192.168.0.23:3000" -ForegroundColor Gray
    Write-Host "  Hot-reload port: 24678" -ForegroundColor Gray
    Write-Host "  Redis Commander: http://localhost:8081" -ForegroundColor Gray
    Write-Host "  pgAdmin: http://localhost:8080" -ForegroundColor Gray
    Write-Host "  Grafana: http://localhost:3001" -ForegroundColor Gray
    Write-Host "  Prometheus: http://localhost:9090" -ForegroundColor Gray
    Write-Host "  Jaeger: http://localhost:16686" -ForegroundColor Gray
    Write-Host "  Kibana: http://localhost:5601" -ForegroundColor Gray
    Write-Host "  Portainer: http://localhost:9000" -ForegroundColor Gray
}

# Main execution
try {
    # Check Docker
    if (-not (Test-DockerRunning)) {
        exit 1
    }

    # Confirm action
    if (-not $Force) {
        Write-Host "`n⚠️  This will rebuild the development environment with hot-updates." -ForegroundColor Yellow
        $confirm = Read-Host "Are you sure you want to continue? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Host "❌ Operation cancelled" -ForegroundColor Red
            exit 0
        }
    }

    # Execute steps
    Clear-DevCaches
    New-Backup
    Stop-DevContainers
    Remove-DevImages
    Build-DevImage
    Start-DevDeployment

    # Wait a bit and verify
    Start-Sleep -Seconds 10
    Test-DevDeployment

    Write-Host "`n🎉 Development rebuild completed successfully!" -ForegroundColor Green
    Write-Host "🔥 Hot-updates are now active - changes to your code will reload instantly!" -ForegroundColor Cyan
    Show-DevCommands

}
catch {
    Write-Host "❌ An error occurred: $_" -ForegroundColor Red
    exit 1
}
