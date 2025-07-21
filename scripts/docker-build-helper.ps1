# Docker Build Helper Script for Windows
# Prevents hanging builds and provides better debugging

param(
    [string]$Command = "build",
    [string]$Dockerfile = "scripts/docker/Dockerfile",
    [string]$Target = "runner",
    [string]$Tag = "test",
    [int]$BuildTimeout = 1800,  # 30 minutes
    [int]$TestTimeout = 300     # 5 minutes
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$Cyan = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Get-Timestamp {
    return Get-Date -Format "HH:mm:ss"
}

# Function to cleanup Docker resources
function Cleanup-Docker {
    Write-ColorOutput "[$(Get-Timestamp)] 🧹 Cleaning up Docker resources..." $Yellow
    
    try {
        # Stop all running containers
        Write-ColorOutput "Stopping containers..." $Cyan
        docker ps -q | ForEach-Object { docker stop $_ } | Out-Null
        
        # Remove stopped containers
        Write-ColorOutput "Removing containers..." $Cyan
        docker ps -aq | ForEach-Object { docker rm -f $_ } | Out-Null
        
        # Remove dangling images
        Write-ColorOutput "Removing dangling images..." $Cyan
        docker image prune -f | Out-Null
        
        # Remove unused volumes
        Write-ColorOutput "Removing unused volumes..." $Cyan
        docker volume prune -f | Out-Null
        
        # Remove unused networks
        Write-ColorOutput "Removing unused networks..." $Cyan
        docker network prune -f | Out-Null
        
        Write-ColorOutput "[$(Get-Timestamp)] ✅ Cleanup completed" $Green
    }
    catch {
        Write-ColorOutput "[$(Get-Timestamp)] ⚠️ Some cleanup operations failed: $($_.Exception.Message)" $Yellow
    }
}

# Function to check Docker daemon health
function Test-DockerHealth {
    Write-ColorOutput "[$(Get-Timestamp)] 🔍 Checking Docker daemon health..." $Blue
    
    try {
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "[$(Get-Timestamp)] ❌ Docker daemon is not responding" $Red
            return $false
        }
        
        Write-ColorOutput "[$(Get-Timestamp)] ✅ Docker daemon is healthy" $Green
        
        # Check available resources
        Write-ColorOutput "Available disk space:" $Cyan
        Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DeviceID -eq "C:" } | ForEach-Object {
            Write-ColorOutput "  $($_.DeviceID) - $([math]::Round($_.FreeSpace/1GB, 2)) GB free of $([math]::Round($_.Size/1GB, 2)) GB" $Cyan
        }
        
        Write-ColorOutput "Available memory:" $Cyan
        $memory = Get-WmiObject -Class Win32_OperatingSystem
        $freeMemoryGB = [math]::Round($memory.FreePhysicalMemory / 1MB, 2)
        $totalMemoryGB = [math]::Round($memory.TotalVisibleMemorySize / 1MB, 2)
        Write-ColorOutput "  $freeMemoryGB GB free of $totalMemoryGB GB" $Cyan
        
        Write-ColorOutput "Docker system info:" $Cyan
        docker system df
        
        return $true
    }
    catch {
        Write-ColorOutput "[$(Get-Timestamp)] ❌ Error checking Docker health: $($_.Exception.Message)" $Red
        return $false
    }
}

# Function to build Docker image with timeout and monitoring
function Build-DockerImage {
    Write-ColorOutput "[$(Get-Timestamp)] 🏗️ Building Docker image..." $Blue
    
    # Check if Dockerfile exists
    if (-not (Test-Path $Dockerfile)) {
        Write-ColorOutput "[$(Get-Timestamp)] ❌ Dockerfile not found: $Dockerfile" $Red
        exit 1
    }
    
    # Build with timeout and monitoring
    Write-ColorOutput "Starting build with timeout ${BuildTimeout}s..." $Cyan
    Write-ColorOutput "Dockerfile: $Dockerfile" $Cyan
    Write-ColorOutput "Target: $Target" $Cyan
    Write-ColorOutput "Tag: cloudlessgr-app:$Tag" $Cyan
    
    try {
        # Build command with timeout
        $buildArgs = @(
            "build",
            "--file", $Dockerfile,
            "--target", $Target,
            "--tag", "cloudlessgr-app:$Tag",
            "--build-arg", "NODE_ENV=production",
            "--build-arg", "BUILD_DATE=$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')",
            "--build-arg", "GIT_COMMIT=$(git rev-parse HEAD 2>$null || 'unknown')",
            "--build-arg", "APP_VERSION=$(git describe --tags 2>$null || 'dev')",
            "--progress=plain",
            "--no-cache",
            "."
        )
        
        # Start build process with timeout
        $job = Start-Job -ScriptBlock {
            param($args)
            & docker @args
        } -ArgumentList $buildArgs
        
        # Wait for job with timeout
        $result = Wait-Job -Job $job -Timeout $BuildTimeout
        
        if ($result) {
            $output = Receive-Job -Job $job
            Remove-Job -Job $job
            
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "[$(Get-Timestamp)] ✅ Docker build completed successfully" $Green
                
                # Show build results
                Write-ColorOutput "Built image info:" $Cyan
                docker images "cloudlessgr-app:$Tag" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
            }
            else {
                throw "Docker build failed with exit code $LASTEXITCODE"
            }
        }
        else {
            # Timeout occurred
            Stop-Job -Job $job
            Remove-Job -Job $job
            throw "Build timed out after ${BuildTimeout}s"
        }
    }
    catch {
        Write-ColorOutput "[$(Get-Timestamp)] ❌ Docker build failed: $($_.Exception.Message)" $Red
        Write-ColorOutput "Checking for issues..." $Yellow
        
        # Check Docker daemon status
        Write-ColorOutput "Docker daemon status:" $Cyan
        docker system df 2>$null || Write-ColorOutput "Cannot check Docker system" $Yellow
        
        # Check for hanging processes
        Write-ColorOutput "Docker processes:" $Cyan
        Get-Process | Where-Object { $_.ProcessName -like "*docker*" } | ForEach-Object {
            Write-ColorOutput "  $($_.ProcessName) (PID: $($_.Id))" $Cyan
        }
        
        exit 1
    }
}

# Function to test Docker image
function Test-DockerImage {
    Write-ColorOutput "[$(Get-Timestamp)] 🧪 Testing Docker image..." $Blue
    
    try {
        # Test with timeout
        Write-ColorOutput "Running tests with timeout ${TestTimeout}s..." $Cyan
        
        $testJob = Start-Job -ScriptBlock {
            docker run --rm "cloudlessgr-app:$using:Tag" npm test
        }
        
        $testResult = Wait-Job -Job $testJob -Timeout $TestTimeout
        
        if ($testResult) {
            $testOutput = Receive-Job -Job $testJob
            Remove-Job -Job $testJob
            
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "[$(Get-Timestamp)] ✅ Docker tests completed successfully" $Green
            }
            else {
                Write-ColorOutput "[$(Get-Timestamp)] ⚠️ Docker tests failed, but continuing..." $Yellow
            }
        }
        else {
            Stop-Job -Job $testJob
            Remove-Job -Job $testJob
            Write-ColorOutput "[$(Get-Timestamp)] ⚠️ Docker tests timed out, but continuing..." $Yellow
        }
    }
    catch {
        Write-ColorOutput "[$(Get-Timestamp)] ⚠️ Docker tests failed: $($_.Exception.Message)" $Yellow
    }
}

# Function to show build summary
function Show-BuildSummary {
    Write-ColorOutput "[$(Get-Timestamp)] 📊 Build Summary" $Blue
    Write-ColorOutput "==================" $Blue
    Write-ColorOutput "Dockerfile: $Dockerfile" $Cyan
    Write-ColorOutput "Target: $Target" $Cyan
    Write-ColorOutput "Tag: $Tag" $Cyan
    Write-ColorOutput "Build time: $(Get-Date)" $Cyan
    Write-ColorOutput ""
    
    try {
        Write-ColorOutput "Image details:" $Cyan
        docker images "cloudlessgr-app:$Tag" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    }
    catch {
        Write-ColorOutput "Could not retrieve image details" $Yellow
    }
    
    Write-ColorOutput ""
    Write-ColorOutput "[$(Get-Timestamp)] 🎉 Build process completed!" $Green
}

# Main execution
function Start-DockerBuild {
    Write-ColorOutput "[$(Get-Timestamp)] 🚀 Starting Docker build process..." $Blue
    Write-ColorOutput "🐳 Docker Build Helper for Windows" $Blue
    Write-ColorOutput "==================================" $Blue
    Write-ColorOutput "Dockerfile: $Dockerfile" $Cyan
    Write-ColorOutput "Target: $Target" $Cyan
    Write-ColorOutput "Tag: $Tag" $Cyan
    Write-ColorOutput "Build timeout: ${BuildTimeout}s" $Cyan
    Write-ColorOutput ""
    
    # Pre-build cleanup
    Cleanup-Docker
    
    # Check Docker health
    if (-not (Test-DockerHealth)) {
        Write-ColorOutput "[$(Get-Timestamp)] ❌ Docker health check failed. Exiting." $Red
        exit 1
    }
    
    # Build image
    Build-DockerImage
    
    # Test image
    Test-DockerImage
    
    # Post-build cleanup
    Cleanup-Docker
    
    # Show summary
    Show-BuildSummary
}

# Handle script arguments
switch ($Command.ToLower()) {
    "cleanup" {
        Cleanup-Docker
    }
    "health" {
        Test-DockerHealth
    }
    "build" {
        Build-DockerImage
    }
    "test" {
        Test-DockerImage
    }
    "help" {
        Write-ColorOutput "Docker Build Helper for Windows" $Blue
        Write-ColorOutput ""
        Write-ColorOutput "Usage: .\docker-build-helper.ps1 [command] [options]" $Cyan
        Write-ColorOutput ""
        Write-ColorOutput "Commands:" $Yellow
        Write-ColorOutput "  cleanup  - Clean up Docker resources" $Cyan
        Write-ColorOutput "  health   - Check Docker daemon health" $Cyan
        Write-ColorOutput "  build    - Build Docker image only" $Cyan
        Write-ColorOutput "  test     - Test Docker image only" $Cyan
        Write-ColorOutput "  help     - Show this help" $Cyan
        Write-ColorOutput ""
        Write-ColorOutput "Examples:" $Yellow
        Write-ColorOutput "  .\docker-build-helper.ps1                                    # Full build process" $Cyan
        Write-ColorOutput "  .\docker-build-helper.ps1 cleanup                           # Clean up only" $Cyan
        Write-ColorOutput "  .\docker-build-helper.ps1 build -Dockerfile Dockerfile.dev  # Build with custom Dockerfile" $Cyan
        Write-ColorOutput ""
    }
    default {
        Start-DockerBuild
    }
} 