#!/usr/bin/env pwsh
# Ultra-Optimized Development Docker Script
# Fast startup with minimal resource usage

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "logs", "shell", "status", "build", "clean")]
    [string]$Action = "start"
)

$ComposeFile = "docker-compose.dev.yml"
$ProjectName = "cloudlessgr"

function Write-Status {
    param([string]$Message, [string]$Color = "Green")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Color
}

function Start-DevEnvironment {
    Write-Status "🚀 Starting ultra-optimized development environment..." "Cyan"
    
    # Stop any existing containers first
    Write-Status "🛑 Stopping existing containers..." "Yellow"
    docker compose -f $ComposeFile down --remove-orphans 2>$null
    
    # Build with BuildKit for faster builds
    Write-Status "🔨 Building optimized development image..." "Yellow"
    $env:DOCKER_BUILDKIT = "1"
    docker compose -f $ComposeFile build --no-cache --parallel
    
    # Start services
    Write-Status "⚡ Starting services..." "Yellow"
    docker compose -f $ComposeFile up -d
    
    # Wait for services to be ready
    Write-Status "⏳ Waiting for services to be ready..." "Yellow"
    Start-Sleep -Seconds 10
    
    # Show status
    Show-Status
    
    Write-Status "✅ Development environment started!" "Green"
    Write-Status "🌐 Main Application: http://192.168.0.23:3000" "Cyan"
    Write-Status "🔧 Redis Commander: http://192.168.0.23:8081" "Cyan"
    Write-Status "🐛 Node.js Debugger: http://192.168.0.23:9229" "Cyan"
    Write-Status "📊 Monitor with: .\scripts\docker\dev-docker.ps1 logs" "Cyan"
}

function Stop-DevEnvironment {
    Write-Status "🛑 Stopping development environment..." "Yellow"
    docker compose -f $ComposeFile down --remove-orphans
    Write-Status "✅ Development environment stopped!" "Green"
}

function Restart-DevEnvironment {
    Write-Status "🔄 Restarting development environment..." "Yellow"
    Stop-DevEnvironment
    Start-Sleep -Seconds 2
    Start-DevEnvironment
}

function Show-Logs {
    Write-Status "📊 Showing development logs..." "Cyan"
    docker compose -f $ComposeFile logs -f --tail=50
}

function Enter-Shell {
    Write-Status "🐚 Entering development container shell..." "Cyan"
    docker compose -f $ComposeFile exec app-dev sh
}

function Show-Status {
    Write-Status "📊 Development environment status:" "Cyan"
    docker compose -f $ComposeFile ps
    
    Write-Status "📈 Container resource usage:" "Cyan"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
}

function Build-DevEnvironment {
    Write-Status "🔨 Building development environment..." "Yellow"
    $env:DOCKER_BUILDKIT = "1"
    docker compose -f $ComposeFile build --no-cache --parallel
    Write-Status "✅ Build completed!" "Green"
}

function Clean-DevEnvironment {
    Write-Status "🧹 Cleaning development environment..." "Yellow"
    
    # Stop and remove containers
    docker compose -f $ComposeFile down --remove-orphans --volumes
    
    # Remove images
    docker rmi cloudlessgr-app-dev:latest 2>$null
    
    # Clean up unused resources
    docker system prune -f
    
    Write-Status "✅ Cleanup completed!" "Green"
}

# Main execution
try {
    switch ($Action.ToLower()) {
        "start" { Start-DevEnvironment }
        "stop" { Stop-DevEnvironment }
        "restart" { Restart-DevEnvironment }
        "logs" { Show-Logs }
        "shell" { Enter-Shell }
        "status" { Show-Status }
        "build" { Build-DevEnvironment }
        "clean" { Clean-DevEnvironment }
        default {
            Write-Status "❌ Unknown action: $Action" "Red"
            Write-Status "Available actions: start, stop, restart, logs, shell, status, build, clean" "Yellow"
        }
    }
}
catch {
    Write-Status "❌ Error: $($_.Exception.Message)" "Red"
    exit 1
} 