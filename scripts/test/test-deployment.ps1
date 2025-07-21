# Test Deployment Script for Cloudless (PowerShell)
param(
    [string]$Action = "test",
    [string]$TestIP = "192.168.0.23",
    [string]$TestPort = "3000"
)

# Configuration
$TestURL = "http://$TestIP`:$TestPort"

# Functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if Docker is running
function Test-Docker {
    try {
        docker info | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Build and start the application
function Start-App {
    Write-Info "Building and starting the application..."
    
    # Stop any existing containers
    docker-compose down 2>$null
    
    # Build and start
    docker-compose up -d --build
    
    Write-Success "Application deployed successfully"
}

# Wait for application to start
function Wait-ForApp {
    Write-Info "Waiting for application to start..."
    
    $maxAttempts = 30
    $attempt = 1
    
    while ($attempt -le $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri $TestURL -Method GET -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "Application is responding at $TestURL"
                return $true
            }
        }
        catch {
            # Ignore errors during startup
        }
        
        Write-Info "Attempt $attempt/$maxAttempts - Application not ready yet..."
        Start-Sleep -Seconds 2
        $attempt++
    }
    
    Write-Error "Application failed to start within expected time"
    return $false
}

# Test application functionality
function Test-App {
    Write-Info "Testing application functionality..."
    
    # Test basic connectivity
    try {
        $response = Invoke-WebRequest -Uri $TestURL -Method GET -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Success "✓ Basic connectivity test passed"
        }
        else {
            Write-Error "✗ Basic connectivity test failed"
            return $false
        }
    }
    catch {
        Write-Error "✗ Basic connectivity test failed"
        return $false
    }
    
    # Test health endpoint (if available)
    try {
        $healthResponse = Invoke-WebRequest -Uri "$TestURL/health" -Method GET -TimeoutSec 5 -UseBasicParsing
        if ($healthResponse.StatusCode -eq 200) {
            Write-Success "✓ Health endpoint test passed"
        }
    }
    catch {
        Write-Warning "⚠ Health endpoint not available (this is normal for basic setup)"
    }
    
    # Test API endpoint (if available)
    try {
        $apiResponse = Invoke-WebRequest -Uri "$TestURL/api" -Method GET -TimeoutSec 5 -UseBasicParsing
        if ($apiResponse.StatusCode -eq 200) {
            Write-Success "✓ API endpoint test passed"
        }
    }
    catch {
        Write-Warning "⚠ API endpoint not available (this is normal for basic setup)"
    }
    
    return $true
}

# Show container status
function Show-Status {
    Write-Info "Container Status:"
    docker-compose ps
    
    Write-Info "Application URLs:"
    Write-Host "  Local: http://localhost:3000"
    Write-Host "  Network: $TestURL"
    
    Write-Info "Container Logs (last 10 lines):"
    docker-compose logs --tail=10 app
}

# Cleanup function
function Remove-App {
    Write-Info "Cleaning up test deployment..."
    docker-compose down
    Write-Success "Cleanup completed"
}

# Main test function
function Start-Test {
    Write-Info "Starting Docker deployment test..."
    
    # Check prerequisites
    if (-not (Test-Docker)) {
        Write-Error "Docker is not running. Please start Docker and try again."
        exit 1
    }
    
    # Deploy application
    Start-App
    
    # Wait for application to start
    if (Wait-ForApp) {
        # Test functionality
        if (Test-App) {
            Write-Success "All tests passed! 🎉"
            Show-Status
        }
        else {
            Write-Error "Some tests failed"
            Show-Status
            exit 1
        }
    }
    else {
        Write-Error "Application failed to start"
        Show-Status
        exit 1
    }
}

# Show usage
function Show-Usage {
    Write-Host "Usage: .\test-deployment.ps1 [option]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  test       Run deployment test (default)"
    Write-Host "  status     Show current status"
    Write-Host "  logs       Show application logs"
    Write-Host "  cleanup    Stop and remove containers"
    Write-Host "  help       Show this help message"
    Write-Host ""
    Write-Host "Parameters:"
    Write-Host "  -TestIP    IP address to test (default: 192.168.0.23)"
    Write-Host "  -TestPort  Port to test (default: 3000)"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\test-deployment.ps1"
    Write-Host "  .\test-deployment.ps1 -Action status"
    Write-Host "  .\test-deployment.ps1 -TestIP 192.168.1.100"
}

# Handle command line arguments
switch ($Action.ToLower()) {
    "help" {
        Show-Usage
    }
    "test" {
        Start-Test
    }
    "status" {
        Show-Status
    }
    "logs" {
        docker-compose logs -f app
    }
    "cleanup" {
        Remove-App
    }
    default {
        Write-Error "Unknown option: $Action"
        Show-Usage
        exit 1
    }
} 