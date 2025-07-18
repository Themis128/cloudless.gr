#Requires -Version 5.1
# Enhanced Docker Development Environment Script for Windows
# cspell:ignore Action Service Profile Project Mailhog Perc ction roject Adminer ervice rofile
param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "restart", "logs", "shell", "build", "clean", "status", "debug", "test", "lint", "format", "db", "email", "tools")]
    [string]$Action = "start",
    
    [Parameter(Position = 1)]
    [string]$Service = "app-dev",
    
    [Parameter(Position = 2)]
    [ValidateSet("database", "email")]
    [string]$ProfileName = ""
)

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -Path $ProjectRoot

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

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Start-DevEnvironment {
    param([string]$ProfileName = "")
    Write-Info "Starting development environment..."
    
    # Check if .env file exists
    if (-not (Test-Path -Path ".env")) {
        Write-Info "Creating .env file from example..."
        if (Test-Path -Path ".env.example") {
            Copy-Item -Path ".env.example" -Destination ".env"
            Write-Success ".env file created from example"
        }
        else {
            Write-Warning ".env.example not found. Please create a .env file manually."
        }
    }
    
    # Create necessary directories
    $directories = @("logs", "tmp", "uploads")
    foreach ($dir in $directories) {
        if (-not (Test-Path -Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Info "Created directory: $dir"
        }
    }
    
    # Build and start containers
    $composeArgs = @("-f", "docker-compose.dev.yml", "up", "-d", "--build")
    
    if ($ProfileName) {
        $composeArgs += @("--profile", $ProfileName)
    }
    
    try {
        docker-compose @composeArgs
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Development environment started successfully!"
            Write-Info "Application available at: http://192.168.0.23:3000"
            Write-Info "Node.js debugger available at: 192.168.0.23:9229"
            Write-Info "Redis Commander: http://192.168.0.23:8081"
            
            if ($ProfileName -eq "database") {
                Write-Info "Adminer (Database UI): http://192.168.0.23:8080"
            }
            
            if ($ProfileName -eq "email") {
                Write-Info "Mailhog (Email testing): http://192.168.0.23:8025"
            }
            
            Write-Info "Use 'docker-compose -f docker-compose.dev.yml logs -f' to view logs"
        }
        else {
            Write-Error "Failed to start development environment"
        }
    }
    catch {
        Write-Error "Error starting development environment: $($_.Exception.Message)"
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
    
    Write-Info "`nContainer resource usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

function Start-DebugMode {
    Write-Info "Starting development environment with debugging enabled..."
    $env:NODE_OPTIONS = "--inspect=0.0.0.0:9229"
    Start-DevEnvironment -ProfileName $ProfileName
    Write-Info "Debugger is available at localhost:9229"
    Write-Info "Attach your IDE debugger to this port"
}

function Invoke-Tests {
    Write-Info "Running tests in development container..."
    docker-compose -f docker-compose.dev.yml exec app-dev npm test
}

function Invoke-Lint {
    Write-Info "Running linting in development container..."
    docker-compose -f docker-compose.dev.yml exec app-dev npm run lint
}

function Invoke-Format {
    Write-Info "Running code formatting in development container..."
    docker-compose -f docker-compose.dev.yml exec app-dev npm run format
}

function Start-Database {
    Write-Info "Starting development environment with database..."
    Start-DevEnvironment -ProfileName "database"
}

function Start-Email {
    Write-Info "Starting development environment with email testing..."
    Start-DevEnvironment -ProfileName "email"
}

function Show-DevTools {
    Write-Info "Development Tools Available:"
    Write-Host "  • Application: http://192.168.0.23:3000" -ForegroundColor Green
    Write-Host "  • Node.js Debugger: 192.168.0.23:9229" -ForegroundColor Green
    Write-Host "  • Redis Commander: http://192.168.0.23:8081" -ForegroundColor Green
    Write-Host "  • Adminer (DB UI): http://192.168.0.23:8080" -ForegroundColor Green
    Write-Host "  • Mailhog (Email): http://192.168.0.23:8025" -ForegroundColor Green
    Write-Host "`nUseful Commands:" -ForegroundColor Yellow
    Write-Host "  • View logs: .\scripts\dev-docker.ps1 logs" -ForegroundColor Cyan
    Write-Host "  • Enter shell: .\scripts\dev-docker.ps1 shell" -ForegroundColor Cyan
    Write-Host "  • Run tests: .\scripts\dev-docker.ps1 test" -ForegroundColor Cyan
    Write-Host "  • Lint code: .\scripts\dev-docker.ps1 lint" -ForegroundColor Cyan
}

# Main execution
switch ($Action.ToLower()) {
    "start" { Start-DevEnvironment -ProfileName $ProfileName }
    "stop" { Stop-DevEnvironment }
    "restart" { Restart-DevEnvironment }
    "logs" { Show-Logs }
    "shell" { Enter-Shell }
    "build" { Build-DevImage }
    "clean" { Remove-DevEnvironment }
    "status" { Show-Status }
    "debug" { Start-DebugMode }
    "test" { Invoke-Tests }
    "lint" { Invoke-Lint }
    "format" { Invoke-Format }
    "db" { Start-Database }
    "email" { Start-Email }
    "tools" { Show-DevTools }
    default {
        Write-Error "Unknown action: $Action"
        Write-Info "Available actions: start, stop, restart, logs, shell, build, clean, status, debug, test, lint, format, db, email, tools"
        Write-Info "Usage examples:"
        Write-Info "  .\scripts\dev-docker.ps1 start"
        Write-Info "  .\scripts\dev-docker.ps1 start database"
        Write-Info "  .\scripts\dev-docker.ps1 debug"
        Write-Info "  .\scripts\dev-docker.ps1 tools"
    }
} 