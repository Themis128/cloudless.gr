# Rebuild and Deploy Script for Cloudless.gr
# This script rebuilds the Docker image, removes old containers/images, and deploys with network address 192.168.0.23:3000

param(
    [string]$Environment = "dev",
    [switch]$Force = $false,
    [switch]$SkipBackup = $false
)

Write-Host "🚀 Starting rebuild and deploy process for Cloudless.gr" -ForegroundColor Green
Write-Host "📍 Target Network Address: 192.168.0.23:3000" -ForegroundColor Cyan
Write-Host "🔧 Environment: $Environment" -ForegroundColor Yellow

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

# Function to create backup
function New-Backup {
    if ($SkipBackup) {
        Write-Host "⚠️  Skipping backup as requested" -ForegroundColor Yellow
        return
    }

    Write-Host "📦 Creating backup before rebuild..." -ForegroundColor Blue
    $backupDir = "db-backups/$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

    try {
        # Backup database
        docker exec cloudlessgr-postgres-$Environment pg_dump -U cloudless cloudless_$Environment > "$backupDir/database_backup.sql"
        Write-Host "✅ Database backup created: $backupDir/database_backup.sql" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Could not create database backup: $_" -ForegroundColor Yellow
    }
}

# Function to stop and remove containers
function Remove-Containers {
    Write-Host "🛑 Stopping and removing existing containers..." -ForegroundColor Blue

    $composeFile = if ($Environment -eq "dev") { "docker-compose.dev.yml" } else { "docker-compose.yml" }

    try {
        # Stop containers
        docker-compose -f $composeFile down --remove-orphans
        Write-Host "✅ Containers stopped and removed" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Error stopping containers: $_" -ForegroundColor Yellow
    }
}

# Function to remove old images
function Remove-OldImages {
    Write-Host "🗑️  Removing old Docker images..." -ForegroundColor Blue

    try {
        # Remove old app images
        $oldImages = docker images --filter "reference=cloudlessgr-app*" --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}"
        if ($oldImages) {
            Write-Host "Found old images:" -ForegroundColor Yellow
            Write-Host $oldImages -ForegroundColor Gray

            # Remove images by ID
            $imageIds = docker images --filter "reference=cloudlessgr-app*" --format "{{.ID}}"
            foreach ($id in $imageIds) {
                docker rmi -f $id
                Write-Host "Removed image: $id" -ForegroundColor Green
            }
        }

        # Clean up dangling images
        docker image prune -f
        Write-Host "✅ Old images removed and cleanup completed" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Error removing old images: $_" -ForegroundColor Yellow
    }
}

# Function to build new image
function Build-NewImage {
    Write-Host "🔨 Building new Docker image..." -ForegroundColor Blue

    $composeFile = if ($Environment -eq "dev") { "docker-compose.dev.yml" } else { "docker-compose.yml" }
    $buildArgs = if ($Environment -eq "dev") { "--build-arg NODE_ENV=development" } else { "--build-arg NODE_ENV=production" }

    try {
        # Build with no cache for fresh build
        docker-compose -f $composeFile build --no-cache app-dev
        Write-Host "✅ New image built successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error building new image: $_" -ForegroundColor Red
        exit 1
    }
}

# Function to deploy new containers
function Start-NewDeployment {
    Write-Host "🚀 Starting new deployment..." -ForegroundColor Blue

    $composeFile = if ($Environment -eq "dev") { "docker-compose.dev.yml" } else { "docker-compose.yml" }

    try {
        # Start services
        docker-compose -f $composeFile up -d

        Write-Host "✅ Deployment started successfully" -ForegroundColor Green
        Write-Host "🌐 Application will be available at: http://192.168.0.23:3000" -ForegroundColor Cyan

        # Show container status
        Start-Sleep -Seconds 5
        docker-compose -f $composeFile ps
    }
    catch {
        Write-Host "❌ Error starting deployment: $_" -ForegroundColor Red
        exit 1
    }
}

# Function to verify deployment
function Test-Deployment {
    Write-Host "🔍 Verifying deployment..." -ForegroundColor Blue

    $maxAttempts = 30
    $attempt = 0

    while ($attempt -lt $maxAttempts) {
        $attempt++
        Write-Host "Attempt $attempt/$maxAttempts - Checking application health..." -ForegroundColor Gray

        try {
            $response = Invoke-WebRequest -Uri "http://192.168.0.23:3000/api/health" -TimeoutSec 10 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Application is healthy and responding!" -ForegroundColor Green
                return $true
            }
        }
        catch {
            Write-Host "⏳ Application not ready yet... (Attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
        }

        Start-Sleep -Seconds 10
    }

    Write-Host "⚠️  Application may still be starting up. Check logs with: docker-compose -f $composeFile logs app-dev" -ForegroundColor Yellow
    return $false
}

# Function to show useful commands
function Show-UsefulCommands {
    Write-Host "`n📋 Useful Commands:" -ForegroundColor Cyan
    Write-Host "  View logs: docker-compose -f docker-compose.dev.yml logs -f app-dev" -ForegroundColor Gray
    Write-Host "  Stop services: docker-compose -f docker-compose.dev.yml down" -ForegroundColor Gray
    Write-Host "  Restart app: docker-compose -f docker-compose.dev.yml restart app-dev" -ForegroundColor Gray
    Write-Host "  View containers: docker-compose -f docker-compose.dev.yml ps" -ForegroundColor Gray
    Write-Host "  Access app: http://192.168.0.23:3000" -ForegroundColor Gray
    Write-Host "  Redis Commander: http://localhost:8081" -ForegroundColor Gray
    Write-Host "  pgAdmin: http://localhost:8080" -ForegroundColor Gray
    Write-Host "  Grafana: http://localhost:3001" -ForegroundColor Gray
}

# Main execution
try {
    # Check Docker
    if (-not (Test-DockerRunning)) {
        exit 1
    }

    # Confirm action
    if (-not $Force) {
        Write-Host "`n⚠️  This will stop all containers, remove old images, and rebuild everything." -ForegroundColor Yellow
        $confirm = Read-Host "Are you sure you want to continue? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Host "❌ Operation cancelled" -ForegroundColor Red
            exit 0
        }
    }

    # Execute steps
    New-Backup
    Remove-Containers
    Remove-OldImages
    Build-NewImage
    Start-NewDeployment

    # Wait a bit and verify
    Start-Sleep -Seconds 10
    Test-Deployment

    Write-Host "`n🎉 Rebuild and deploy completed successfully!" -ForegroundColor Green
    Show-UsefulCommands

}
catch {
    Write-Host "❌ An error occurred: $_" -ForegroundColor Red
    exit 1
}
