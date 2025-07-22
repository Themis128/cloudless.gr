#!/usr/bin/env pwsh
# Docker Development Management Script for Cloudless.gr
# Usage: .\docker.ps1 [command] [options]

param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$Service = "",
    
    [switch]$Build,
    [switch]$Logs,
    [switch]$Shell,
    [switch]$Clean,
    [switch]$Force
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
function Write-Color {
    param([string]$Color, [string]$Message)
    Write-Host "$Color$Message$Reset"
}

# Function to check if Docker is running
function Test-Docker {
    try {
        docker version | Out-Null
        return $true
    }
    catch {
        Write-Color $Red "❌ Docker is not running. Please start Docker Desktop first."
        return $false
    }
}

# Function to show help
function Show-Help {
    Write-Color $Cyan "🐳 Cloudless.gr Docker Development Manager"
    Write-Host ""
    Write-Color $Yellow "Usage: .\docker.ps1 [command] [options]"
    Write-Host ""
    Write-Color $Green "Commands:"
    Write-Host "  dev, start     - Start development environment"
    Write-Host "  stop, down     - Stop all containers"
    Write-Host "  restart        - Restart all containers"
    Write-Host "  status         - Show container status"
    Write-Host "  logs [service] - Show logs (all or specific service)"
    Write-Host "  shell [service]- Open shell in container"
    Write-Host "  build          - Rebuild containers"
    Write-Host "  clean          - Clean up containers and images"
    Write-Host "  help           - Show this help"
    Write-Host ""
    Write-Color $Green "Services:"
    Write-Host "  app-dev        - Main application"
    Write-Host "  redis-dev      - Redis database"
    Write-Host "  redis-commander- Redis management UI"
    Write-Host "  postgres-dev   - PostgreSQL database"
    Write-Host "  pgadmin        - PostgreSQL management UI"
    Write-Host ""
    Write-Color $Green "Examples:"
    Write-Host "  .\docker.ps1 dev"
    Write-Host "  .\docker.ps1 logs app-dev"
    Write-Host "  .\docker.ps1 shell app-dev"
    Write-Host "  .\docker.ps1 build"
}

# Function to start development environment
function Start-Dev {
    Write-Color $Blue "🚀 Starting Cloudless.gr development environment..."
    
    if (-not (Test-Docker)) { return }
    
    # Check if .env file exists
    if (-not (Test-Path ".env")) {
        Write-Color $Yellow "⚠️  No .env file found. Creating default development .env..."
        Copy-Item "env.template" ".env" -ErrorAction SilentlyContinue
        if (-not (Test-Path ".env")) {
            Write-Color $Red "❌ Could not create .env file. Please create one manually."
            return
        }
    }
    
    # Start services
    docker-compose -f docker-compose.dev.yml up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Color $Green "✅ Development environment started successfully!"
        Write-Host ""
        Write-Color $Cyan "🌐 Services available at:"
        Write-Host "  App:          http://localhost:3000"
        Write-Host "  Redis UI:     http://localhost:8081"
        Write-Host "  pgAdmin:      http://localhost:8080 (if using --profile database)"
        Write-Host "  MailHog:      http://localhost:8025 (if using --profile email)"
        Write-Host ""
        Write-Color $Yellow "📝 Use '.\docker.ps1 logs' to view logs"
        Write-Color $Yellow "📝 Use '.\docker.ps1 status' to check status"
    }
    else {
        Write-Color $Red "❌ Failed to start development environment"
    }
}

# Function to stop development environment
function Stop-Dev {
    Write-Color $Blue "🛑 Stopping Cloudless.gr development environment..."
    
    if (-not (Test-Docker)) { return }
    
    docker-compose -f docker-compose.dev.yml down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Color $Green "✅ Development environment stopped"
    }
    else {
        Write-Color $Red "❌ Failed to stop development environment"
    }
}

# Function to restart development environment
function Restart-Dev {
    Write-Color $Blue "🔄 Restarting Cloudless.gr development environment..."
    
    if (-not (Test-Docker)) { return }
    
    docker-compose -f docker-compose.dev.yml restart
    
    if ($LASTEXITCODE -eq 0) {
        Write-Color $Green "✅ Development environment restarted"
    }
    else {
        Write-Color $Red "❌ Failed to restart development environment"
    }
}

# Function to show status
function Show-Status {
    Write-Color $Blue "📊 Cloudless.gr Development Environment Status"
    Write-Host ""
    
    if (-not (Test-Docker)) { return }
    
    docker-compose -f docker-compose.dev.yml ps
}

# Function to show logs
function Show-Logs {
    param([string]$ServiceName = "")
    
    if (-not (Test-Docker)) { return }
    
    if ($ServiceName) {
        Write-Color $Blue "📋 Showing logs for $ServiceName..."
        docker-compose -f docker-compose.dev.yml logs -f $ServiceName
    }
    else {
        Write-Color $Blue "📋 Showing all logs..."
        docker-compose -f docker-compose.dev.yml logs -f
    }
}

# Function to open shell
function Open-Shell {
    param([string]$ServiceName = "app-dev")
    
    if (-not (Test-Docker)) { return }
    
    Write-Color $Blue "🐚 Opening shell in $ServiceName..."
    docker-compose -f docker-compose.dev.yml exec $ServiceName /bin/bash
}

# Function to build containers
function Build-Containers {
    Write-Color $Blue "🔨 Building Cloudless.gr containers..."
    
    if (-not (Test-Docker)) { return }
    
    docker-compose -f docker-compose.dev.yml build --no-cache
    
    if ($LASTEXITCODE -eq 0) {
        Write-Color $Green "✅ Containers built successfully"
    }
    else {
        Write-Color $Red "❌ Failed to build containers"
    }
}

# Function to clean up
function Clean-Up {
    Write-Color $Blue "🧹 Cleaning up Docker resources..."
    
    if (-not (Test-Docker)) { return }
    
    if ($Force) {
        Write-Color $Yellow "⚠️  Force cleaning all Docker resources..."
        docker system prune -a -f
        docker volume prune -f
        docker network prune -f
    }
    else {
        Write-Color $Yellow "🧹 Cleaning unused Docker resources..."
        docker system prune -f
        docker volume prune -f
        docker network prune -f
    }
    
    Write-Color $Green "✅ Cleanup completed"
}

# Main script logic
switch ($Command.ToLower()) {
    "help" { Show-Help }
    "dev" { Start-Dev }
    "start" { Start-Dev }
    "stop" { Stop-Dev }
    "down" { Stop-Dev }
    "restart" { Restart-Dev }
    "status" { Show-Status }
    "logs" { Show-Logs $Service }
    "shell" { Open-Shell $Service }
    "build" { Build-Containers }
    "clean" { Clean-Up }
    default {
        Write-Color $Red "❌ Unknown command: $Command"
        Write-Host ""
        Show-Help
    }
} 