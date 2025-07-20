#!/usr/bin/env pwsh
# Optimized Development Docker Startup Script
# This script provides fast development container startup with optimized settings

param(
    [switch]$Build,
    [switch]$Clean,
    [switch]$Logs,
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Database,
    [switch]$Email,
    [switch]$Fast,
    [switch]$Help
)

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Magenta = "`e[35m"
$Cyan = "`e[36m"
$Reset = "`e[0m"

# Function to print colored output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = $Reset)
    Write-Host "$Color$Message$Reset"
}

# Function to show help
function Show-Help {
    Write-ColorOutput "🚀 Optimized Development Docker Commands" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput ""
    Write-ColorOutput "Usage: .\scripts\dev-docker.ps1 [options]" $Yellow
    Write-ColorOutput ""
    Write-ColorOutput "Options:" $Yellow
    Write-ColorOutput "  -Build     Build/rebuild the development container" $Green
    Write-ColorOutput "  -Clean     Clean up containers, volumes, and images" $Red
    Write-ColorOutput "  -Logs      Show container logs" $Blue
    Write-ColorOutput "  -Stop      Stop all development containers" $Red
    Write-ColorOutput "  -Restart   Restart development containers" $Yellow
    Write-ColorOutput "  -Database  Start with PostgreSQL database" $Magenta
    Write-ColorOutput "  -Email     Start with Mailhog email testing" $Magenta
    Write-ColorOutput "  -Fast      Skip building if image already exists" $Yellow
    Write-ColorOutput "  -Help      Show this help message" $Cyan
    Write-ColorOutput ""
    Write-ColorOutput "Examples:" $Yellow
    Write-ColorOutput "  .\scripts\dev-docker.ps1 -Build" $Green
    Write-ColorOutput "  .\scripts\dev-docker.ps1 -Database" $Green
    Write-ColorOutput "  .\scripts\dev-docker.ps1 -Logs" $Green
    Write-ColorOutput "  .\scripts\dev-docker.ps1 -Clean" $Green
}

# Function to check if Docker is running
function Test-DockerRunning {
    try {
        docker info | Out-Null
        return $true
    }
    catch {
        Write-ColorOutput "❌ Docker is not running. Please start Docker Desktop first." $Red
        return $false
    }
}

# Function to enable BuildKit for faster builds
function Enable-BuildKit {
    Write-ColorOutput "🔧 Enabling BuildKit for faster builds..." $Blue
    $env:DOCKER_BUILDKIT = "1"
    $env:COMPOSE_DOCKER_CLI_BUILD = "1"
}

# Function to build/rebuild containers
function Start-Build {
    Write-ColorOutput "🏗️  Building optimized development containers..." $Blue
    
    # Enable BuildKit
    Enable-BuildKit
    
    # Build with optimized settings
    $composeArgs = @("-f", "docker-compose.dev.yml", "build", "--no-cache", "--parallel")
    
    if ($Database) {
        $composeArgs += "--profile", "database"
    }
    if ($Email) {
        $composeArgs += "--profile", "email"
    }
    
    docker compose @composeArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Build completed successfully!" $Green
    }
    else {
        Write-ColorOutput "❌ Build failed!" $Red
        exit 1
    }
}

# Function to check if development image exists
function Test-DevImageExists {
    $imageExists = docker images --format "table {{.Repository}}:{{.Tag}}" | Select-String "cloudlessgr-app-dev:latest"
    return $null -ne $imageExists
}

# Function to start development environment
function Start-Development {
    Write-ColorOutput "🚀 Starting optimized development environment..." $Blue
    
    # Enable BuildKit
    Enable-BuildKit
    
    # Check if we should skip building
    if ($Fast -and (Test-DevImageExists)) {
        Write-ColorOutput "⚡ Fast mode: Using existing image (skipping build)" $Yellow
    }
    else {
        Write-ColorOutput "🔨 Building development image..." $Blue
        Start-Build
    }
    
    # Prepare compose arguments
    $composeArgs = @("-f", "docker-compose.dev.yml", "up", "-d")
    
    if ($Database) {
        $composeArgs += "--profile", "database"
    }
    if ($Email) {
        $composeArgs += "--profile", "email"
    }
    
    # Start containers
    docker compose @composeArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Development environment started successfully!" $Green
        Write-ColorOutput ""
        Write-ColorOutput "🌐 Application URLs:" $Cyan
        Write-ColorOutput "   Main App: http://localhost:3000" $Green
        Write-ColorOutput "   Debugger: http://localhost:9229" $Green
        
        if ($Database) {
            Write-ColorOutput "   Adminer: http://localhost:8080" $Green
            Write-ColorOutput "   PostgreSQL: localhost:5432" $Green
        }
        
        if ($Email) {
            Write-ColorOutput "   Mailhog: http://localhost:8025" $Green
        }
        
        Write-ColorOutput "   Redis Commander: http://localhost:8081" $Green
        Write-ColorOutput ""
        Write-ColorOutput "📝 Useful commands:" $Cyan
        Write-ColorOutput "   View logs: .\scripts\dev-docker.ps1 -Logs" $Yellow
        Write-ColorOutput "   Stop containers: .\scripts\dev-docker.ps1 -Stop" $Yellow
        Write-ColorOutput "   Restart: .\scripts\dev-docker.ps1 -Restart" $Yellow
        Write-ColorOutput "   Fast start: .\scripts\dev-docker.ps1 -Fast" $Yellow
    }
    else {
        Write-ColorOutput "❌ Failed to start development environment!" $Red
        exit 1
    }
}

# Function to show logs
function Show-Logs {
    Write-ColorOutput "📋 Showing development container logs..." $Blue
    docker compose -f docker-compose.dev.yml logs -f app-dev
}

# Function to stop containers
function Stop-Containers {
    Write-ColorOutput "🛑 Stopping development containers..." $Yellow
    docker compose -f docker-compose.dev.yml down
    Write-ColorOutput "✅ Containers stopped!" $Green
}

# Function to restart containers
function Restart-Containers {
    Write-ColorOutput "🔄 Restarting development containers..." $Yellow
    Stop-Containers
    Start-Sleep -Seconds 2
    Start-Development
}

# Function to clean up everything
function Remove-Environment {
    Write-ColorOutput "🧹 Cleaning up development environment..." $Yellow
    
    # Stop and remove containers
    docker compose -f docker-compose.dev.yml down -v
    
    # Remove development images
    docker rmi cloudlessgr-app-dev:latest 2>$null
    
    # Clean up unused resources
    docker system prune -f
    
    # Clean up volumes
    docker volume prune -f
    
    Write-ColorOutput "✅ Cleanup completed!" $Green
}

# Main script logic
if ($Help) {
    Show-Help
    exit 0
}

# Check if Docker is running
if (-not (Test-DockerRunning)) {
    exit 1
}

# Handle different commands
if ($Clean) {
    Remove-Environment
}
elseif ($Stop) {
    Stop-Containers
}
elseif ($Restart) {
    Restart-Containers
}
elseif ($Logs) {
    Show-Logs
}
elseif ($Build) {
    Start-Build
    Start-Development
}
else {
    # Default: start development environment
    Start-Development
} 