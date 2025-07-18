# Docker Development Environment Script for Windows
param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "restart", "logs", "shell", "build", "clean", "status")]
    [string]$Action = "start",
    
    [Parameter(Position = 1)]
    [string]$Service = "app-dev"
)

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Start-DevEnvironment {
    Write-Info "Starting development environment..."
    
    # Check if .env file exists
    if (-not (Test-Path ".env")) {
        Write-Info "Creating .env file from example..."
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
        }
        else {
            Write-Error ".env.example not found. Please create a .env file manually."
            return
        }
    }
    
    # Build and start containers
    docker-compose -f docker-compose.dev.yml up -d --build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Development environment started successfully!"
        Write-Info "Application available at: http://localhost:3000"
        Write-Info "Use 'docker-compose -f docker-compose.dev.yml logs -f' to view logs"
    }
    else {
        Write-Error "Failed to start development environment"
    }
}

function Stop-DevEnvironment {
    Write-Info "Stopping development environment..."
    docker-compose -f docker-compose.dev.yml down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Development environment stopped successfully!"
    }
    else {
        Write-Error "Failed to stop development environment"
    }
}

function Restart-DevEnvironment {
    Write-Info "Restarting development environment..."
    Stop-DevEnvironment
    Start-Sleep -Seconds 2
    Start-DevEnvironment
}

function Show-Logs {
    Write-Info "Showing logs for $Service..."
    docker-compose -f docker-compose.dev.yml logs -f $Service
}

function Enter-Shell {
    Write-Info "Opening shell in $Service container..."
    docker-compose -f docker-compose.dev.yml exec $Service sh
}

function Build-DevImage {
    Write-Info "Building development image..."
    docker-compose -f docker-compose.dev.yml build --no-cache
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Development image built successfully!"
    }
    else {
        Write-Error "Failed to build development image"
    }
}

function Remove-DevEnvironment {
    Write-Info "Cleaning development environment..."
    docker-compose -f docker-compose.dev.yml down -v --remove-orphans
    docker system prune -f
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Development environment cleaned successfully!"
    }
    else {
        Write-Error "Failed to clean development environment"
    }
}

function Show-Status {
    Write-Info "Development environment status:"
    docker-compose -f docker-compose.dev.yml ps
}

# Main execution
switch ($Action.ToLower()) {
    "start" { Start-DevEnvironment }
    "stop" { Stop-DevEnvironment }
    "restart" { Restart-DevEnvironment }
    "logs" { Show-Logs }
    "shell" { Enter-Shell }
    "build" { Build-DevImage }
    "clean" { Remove-DevEnvironment }
    "status" { Show-Status }
    default {
        Write-Error "Unknown action: $Action"
        Write-Info "Available actions: start, stop, restart, logs, shell, build, clean, status"
    }
} 