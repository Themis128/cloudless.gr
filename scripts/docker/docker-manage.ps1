#!/usr/bin/env pwsh
# Docker Management Script for Cloudless.gr
# This script provides easy commands to manage development and production containers

param(
    [Parameter(Position = 0)]
    [ValidateSet("dev", "prod", "help")]
    [string]$Environment = "dev",
    
    [Parameter(Position = 1)]
    [ValidateSet("up", "down", "stop", "start", "restart", "logs", "build", "rebuild", "clean", "status")]
    [string]$Action = "help"
)

$DevComposeFile = "docker-compose.dev.yml"
$ProdComposeFile = "docker-compose.prod.yml"

function Show-Help {
    Write-Host "🚀 Cloudless.gr Docker Management Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\scripts\docker-manage.ps1 [environment] [action]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Environments:" -ForegroundColor Green
    Write-Host "  dev   - Development environment (default)" -ForegroundColor White
    Write-Host "  prod  - Production environment" -ForegroundColor White
    Write-Host "  help  - Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Actions:" -ForegroundColor Green
    Write-Host "  up      - Start containers" -ForegroundColor White
    Write-Host "  down    - Stop and remove containers" -ForegroundColor White
    Write-Host "  stop    - Stop containers" -ForegroundColor White
    Write-Host "  start   - Start existing containers" -ForegroundColor White
    Write-Host "  restart - Restart containers" -ForegroundColor White
    Write-Host "  logs    - Show container logs" -ForegroundColor White
    Write-Host "  build   - Build and start containers" -ForegroundColor White
    Write-Host "  rebuild - Full rebuild from scratch" -ForegroundColor White
    Write-Host "  clean   - Remove containers and volumes" -ForegroundColor White
    Write-Host "  status  - Show container status" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Green
    Write-Host "  .\scripts\docker-manage.ps1 dev up" -ForegroundColor White
    Write-Host "  .\scripts\docker-manage.ps1 dev logs" -ForegroundColor White
    Write-Host "  .\scripts\docker-manage.ps1 prod build" -ForegroundColor White
    Write-Host ""
}

function Invoke-DockerCompose {
    param(
        [string]$ComposeFile,
        [string[]]$Command
    )
    
    Write-Host "🐳 Executing: docker compose -f $ComposeFile $($Command -join ' ')" -ForegroundColor Yellow
    docker compose -f $ComposeFile @Command
}

# Show help if requested
if ($Environment -eq "help" -or $Action -eq "help") {
    Show-Help
    exit 0
}

# Determine which compose file to use
$ComposeFile = if ($Environment -eq "prod") { $ProdComposeFile } else { $DevComposeFile }

# Execute the appropriate action
switch ($Action) {
    "up" {
        Write-Host "🚀 Starting $Environment environment..." -ForegroundColor Green
        Invoke-DockerCompose -ComposeFile $ComposeFile -Command @("up", "-d")
    }
    "down" {
        Write-Host "🛑 Stopping and removing $Environment containers..." -ForegroundColor Red
        Invoke-DockerCompose -ComposeFile $ComposeFile -Command @("down")
    }
    "stop" {
        Write-Host "⏹️  Stopping $Environment containers..." -ForegroundColor Yellow
        Invoke-DockerCompose -ComposeFile $ComposeFile -Command @("stop")
    }
    "start" {
        Write-Host "▶️  Starting $Environment containers..." -ForegroundColor Green
        Invoke-DockerCompose -ComposeFile $ComposeFile -Command @("start")
    }
    "restart" {
        Write-Host "🔄 Restarting $Environment containers..." -ForegroundColor Yellow
        Invoke-DockerCompose -ComposeFile $ComposeFile -Command @("restart")
    }
    "logs" {
        Write-Host "📋 Showing $Environment container logs..." -ForegroundColor Cyan
        Invoke-DockerCompose -ComposeFile $ComposeFile -Command @("logs", "-f")
    }
    "build" {
        Write-Host "🔨 Building and starting $Environment containers..." -ForegroundColor Green
        Invoke-DockerCompose -ComposeFile $ComposeFile -Command @("up", "-d", "--build")
    }
    "rebuild" {
        Write-Host "🔨 Full rebuild of $Environment containers..." -ForegroundColor Green
        Invoke-DockerCompose -ComposeFile $ComposeFile -Command @("down", "-v")
        Invoke-DockerCompose -ComposeFile $ComposeFile -Command @("up", "-d", "--build")
    }
    "clean" {
        Write-Host "🧹 Cleaning $Environment containers and volumes..." -ForegroundColor Red
        Invoke-DockerCompose -ComposeFile $ComposeFile -Command @("down", "-v")
        docker system prune -f
    }
    "status" {
        Write-Host "📊 $Environment container status:" -ForegroundColor Cyan
        Invoke-DockerCompose -ComposeFile $ComposeFile -Command @("ps")
    }
    default {
        Write-Host "❌ Unknown action: $Action" -ForegroundColor Red
        Show-Help
        exit 1
    }
} 