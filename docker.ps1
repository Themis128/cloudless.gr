# Cloudless.gr Docker PowerShell Script
# Windows-compatible Docker operations for development and production

param(
    [Parameter(Position=0)]
    [string]$Command = "help",

    [Parameter(Position=1)]
    [string]$Environment = "dev",

    [switch]$Fresh,
    [switch]$Build,
    [switch]$Force,
    [switch]$Clean
)

# Variables
$DOCKER_REGISTRY = "cloudlessgr"
$IMAGE_NAME = "cloudlessgr-app"
$DEV_IMAGE = "$DOCKER_REGISTRY/$IMAGE_NAME-dev"
$PROD_IMAGE = "$DOCKER_REGISTRY/$IMAGE_NAME"
$VERSION = if (git describe --tags --always --dirty 2>$null) { git describe --tags --always --dirty } else { "latest" }
$BUILD_DATE = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
$GIT_COMMIT = if (git rev-parse HEAD 2>$null) { git rev-parse HEAD } else { "unknown" }
$PNPM_VERSION = "10.13.1"

function Show-Help {
    Write-Host "Cloudless.gr Docker Commands:" -ForegroundColor Green
    Write-Host ""
    Write-Host "Image Building:" -ForegroundColor Yellow
    Write-Host "  .\docker.ps1 build-dev        - Build development Docker image"
    Write-Host "  .\docker.ps1 build-prod       - Build production Docker image"
    Write-Host "  .\docker.ps1 build-all        - Build both dev and prod images"
    Write-Host "  .\docker.ps1 push-dev         - Push development image to registry"
    Write-Host "  .\docker.ps1 push-prod        - Push production image to registry"
    Write-Host "  .\docker.ps1 push-all         - Push both images to registry"
    Write-Host ""
    Write-Host "Development (with fresh images):" -ForegroundColor Yellow
    Write-Host "  .\docker.ps1 dev              - Start development environment"
    Write-Host "  .\docker.ps1 dev -Fresh       - Build fresh dev image and start"
    Write-Host "  .\docker.ps1 dev -Build       - Build and start development environment"
    Write-Host "  .\docker.ps1 dev -Build -Fresh - Build fresh image and start dev"
    Write-Host "  .\docker.ps1 dev-logs         - Show development logs"
    Write-Host "  .\docker.ps1 dev-stop         - Stop development environment"
    Write-Host ""
    Write-Host "Production (with fresh images):" -ForegroundColor Yellow
    Write-Host "  .\docker.ps1 prod             - Start production environment"
    Write-Host "  .\docker.ps1 prod -Fresh      - Build fresh prod image and start"
    Write-Host "  .\docker.ps1 prod -Build      - Build and start production environment"
    Write-Host "  .\docker.ps1 prod -Build -Fresh - Build fresh image and start prod"
    Write-Host "  .\docker.ps1 prod-logs        - Show production logs"
    Write-Host "  .\docker.ps1 prod-stop        - Stop production environment"
    Write-Host ""
    Write-Host "Testing:" -ForegroundColor Yellow
    Write-Host "  .\docker.ps1 test             - Run tests in Docker"
    Write-Host "  .\docker.ps1 test-e2e         - Run E2E tests"
    Write-Host ""
    Write-Host "Database:" -ForegroundColor Yellow
    Write-Host "  .\docker.ps1 db               - Start database services only"
    Write-Host "  .\docker.ps1 db-stop          - Stop database services"
    Write-Host "  .\docker.ps1 db-reset         - Reset database data"
    Write-Host ""
    Write-Host "Utilities:" -ForegroundColor Yellow
    Write-Host "  .\docker.ps1 clean            - Clean all containers, volumes, and images"
    Write-Host "  .\docker.ps1 logs             - Show all logs"
    Write-Host "  .\docker.ps1 status           - Show container status"
    Write-Host "  .\docker.ps1 build            - Build all images"
    Write-Host "  .\docker.ps1 rebuild          - Rebuild all images (no cache)"
    Write-Host "  .\docker.ps1 restart          - Restart all services"
    Write-Host "  .\docker.ps1 health-dev       - Check development health"
    Write-Host "  .\docker.ps1 health-prod      - Check production health"
}

function Build-DevImage {
    Write-Host "Building development Docker image..." -ForegroundColor Green
    docker build `
        --file Dockerfile.dev `
        --tag "$DEV_IMAGE`:$VERSION" `
        --tag "$DEV_IMAGE`:latest" `
        --build-arg VERSION=$VERSION `
        --build-arg GIT_COMMIT=$GIT_COMMIT `
        --build-arg BUILD_DATE=$BUILD_DATE `
        --build-arg NODE_ENV=development `
        --progress=plain `
        .
}

function Build-ProdImage {
    Write-Host "Building production Docker image..." -ForegroundColor Green
    docker build `
        --file Dockerfile `
        --target production `
        --tag "$PROD_IMAGE`:$VERSION" `
        --tag "$PROD_IMAGE`:latest" `
        --build-arg VERSION=$VERSION `
        --build-arg GIT_COMMIT=$GIT_COMMIT `
        --build-arg BUILD_DATE=$BUILD_DATE `
        --build-arg NODE_ENV=production `
        --progress=plain `
        .
}

function Start-DevEnvironment {
    param([switch]$Fresh, [switch]$Build)

    if ($Build) {
        Build-DevImage
    }

    $composeArgs = @("-f", "docker-compose.dev.yml", "--env-file", ".env", "up", "-d")

    if ($Build) {
        $composeArgs += "--build"
    }

    if ($Fresh) {
        $composeArgs += "--force-recreate"
    }

    Write-Host "Starting development environment..." -ForegroundColor Green
    docker-compose @composeArgs
}

function Start-ProdEnvironment {
    param([switch]$Fresh, [switch]$Build)

    if ($Build) {
        Build-ProdImage
    }

    $composeArgs = @("-f", "docker-compose.yml", "--env-file", ".env", "up", "-d")

    if ($Build) {
        $composeArgs += "--build"
    }

    if ($Fresh) {
        $composeArgs += "--force-recreate"
    }

    Write-Host "Starting production environment..." -ForegroundColor Green
    docker-compose @composeArgs
}

function Test-Health {
    param([string]$Environment)

    Write-Host "Checking $Environment environment health..." -ForegroundColor Green

    if ($Environment -eq "dev") {
        docker-compose -f docker-compose.dev.yml ps
        try {
            Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing | Out-Null
            Write-Host "Health check passed!" -ForegroundColor Green
        }
        catch {
            Write-Host "Health check failed!" -ForegroundColor Red
        }
    }
    else {
        docker-compose -f docker-compose.yml ps
        try {
            Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing | Out-Null
            Write-Host "Health check passed!" -ForegroundColor Green
        }
        catch {
            Write-Host "Health check failed!" -ForegroundColor Red
        }
    }
}

# Main command processing
switch ($Command.ToLower()) {
    "help" { Show-Help }

    "build-dev" { Build-DevImage }
    "build-prod" { Build-ProdImage }
    "build-all" { Build-DevImage; Build-ProdImage; Write-Host "All images built successfully!" -ForegroundColor Green }

    "push-dev" {
        Write-Host "Pushing development image to registry..." -ForegroundColor Green
        docker push "$DEV_IMAGE`:$VERSION"
        docker push "$DEV_IMAGE`:latest"
    }
    "push-prod" {
        Write-Host "Pushing production image to registry..." -ForegroundColor Green
        docker push "$PROD_IMAGE`:$VERSION"
        docker push "$PROD_IMAGE`:latest"
    }
    "push-all" {
        & $PSCommandPath push-dev
        & $PSCommandPath push-prod
        Write-Host "All images pushed successfully!" -ForegroundColor Green
    }

    "dev" { Start-DevEnvironment -Fresh:$Fresh -Build:$Build }
    "dev-logs" { docker-compose -f docker-compose.dev.yml logs -f }
    "dev-stop" { docker-compose -f docker-compose.dev.yml down }

    "prod" { Start-ProdEnvironment -Fresh:$Fresh -Build:$Build }
    "prod-logs" { docker-compose -f docker-compose.yml logs -f }
    "prod-stop" { docker-compose -f docker-compose.yml down }

    "test" { docker-compose -f docker-compose.test.yml --env-file .env up --build --abort-on-container-exit }
    "test-e2e" { docker-compose -f docker-compose.test.yml --env-file .env up playwright --build --abort-on-container-exit }

    "db" { docker-compose -f docker-compose.database.yml --env-file .env up -d }
    "db-stop" { docker-compose -f docker-compose.database.yml down }
    "db-reset" {
        docker-compose -f docker-compose.database.yml down -v
        docker-compose -f docker-compose.database.yml --env-file .env up -d
    }

    "clean" {
        Write-Host "Cleaning all containers, volumes, and images..." -ForegroundColor Yellow
        docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml down -v
        docker system prune -f
        docker volume prune -f
        docker image prune -f
        Write-Host "Cleanup completed!" -ForegroundColor Green
    }

    "logs" { docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml logs -f }
    "status" { docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml ps }

    "build" { & $PSCommandPath build-all }
    "rebuild" {
        Write-Host "Rebuilding all images without cache..." -ForegroundColor Yellow
        docker build --no-cache --file Dockerfile.dev --tag "$DEV_IMAGE`:$VERSION" --tag "$DEV_IMAGE`:latest" .
        docker build --no-cache --file Dockerfile --target production --tag "$PROD_IMAGE`:$VERSION" --tag "$PROD_IMAGE`:latest" .
    }

    "restart" { docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml restart }

    "images" {
        Write-Host "Listing all project images:" -ForegroundColor Green
        docker images | Select-String -Pattern "(cloudlessgr|$IMAGE_NAME)"
    }

    "clean-images" {
        Write-Host "Removing all project images..." -ForegroundColor Yellow
        docker images -q | Where-Object { $_ -match "(cloudlessgr|$IMAGE_NAME)" } | ForEach-Object { docker rmi $_ -f }
    }

    "health-dev" { Test-Health "dev" }
    "health-prod" { Test-Health "prod" }

    "backup-db" {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        Write-Host "Creating database backup..." -ForegroundColor Green
        docker-compose -f docker-compose.database.yml exec postgres pg_dump -U cloudless cloudless_dev > "backup_$timestamp.sql"
    }

    default {
        Write-Host "Unknown command: $Command" -ForegroundColor Red
        Show-Help
    }
}
