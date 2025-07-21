#!/usr/bin/env pwsh

# Self-Hosted Runner Monitoring Script
# Provides real-time monitoring of GitHub Actions runner status and Docker builds

param(
    [switch]$Continuous,
    [int]$Interval = 5,
    [switch]$DockerOnly,
    [switch]$RunnerOnly,
    [switch]$Health
)

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Magenta = "`e[35m"
$Cyan = "`e[36m"
$Reset = "`e[0m"

# Function to write colored output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = $Reset
    )
    Write-Host "$Color$Message$Reset"
}

# Function to get current timestamp
function Get-Timestamp {
    return Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

# Function to check if Docker is running
function Test-DockerStatus {
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            return $true
        }
        return $false
    }
    catch {
        return $false
    }
}

# Function to get Docker build processes
function Get-DockerBuilds {
    try {
        $builds = docker ps --filter "ancestor=ghcr.io/themis128/cloudless.gr" --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}" 2>$null
        if ($builds) {
            return $builds
        }
        return "No active Docker builds found"
    }
    catch {
        return "Error checking Docker builds: $($_.Exception.Message)"
    }
}

# Function to get Docker images
function Get-DockerImages {
    try {
        $images = docker images "ghcr.io/themis128/cloudless.gr*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" 2>$null
        if ($images) {
            return $images
        }
        return "No cloudless.gr images found"
    }
    catch {
        return "Error checking Docker images: $($_.Exception.Message)"
    }
}

# Function to check GitHub Actions runner status
function Get-RunnerStatus {
    try {
        # Check if runner service is running
        $runnerService = Get-Service -Name "actions.runner.*" -ErrorAction SilentlyContinue
        if ($runnerService) {
            return $runnerService | ForEach-Object {
                [PSCustomObject]@{
                    Name = $_.Name
                    Status = $_.Status
                    StartType = $_.StartType
                }
            }
        }
        
        # Check for runner processes
        $runnerProcesses = Get-Process -Name "*runner*" -ErrorAction SilentlyContinue
        if ($runnerProcesses) {
            return $runnerProcesses | ForEach-Object {
                [PSCustomObject]@{
                    Name = $_.ProcessName
                    Id = $_.Id
                    CPU = $_.CPU
                    WorkingSet = [math]::Round($_.WorkingSet / 1MB, 2)
                }
            }
        }
        
        return "No runner processes found"
    }
    catch {
        return "Error checking runner status: $($_.Exception.Message)"
    }
}

# Function to check system resources
function Get-SystemResources {
    try {
        $cpu = Get-Counter "\Processor(_Total)\% Processor Time" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue
        $memory = Get-Counter "\Memory\Available MBytes" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue
        $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object @{Name="FreeGB";Expression={[math]::Round($_.FreeSpace/1GB,2)}}, @{Name="TotalGB";Expression={[math]::Round($_.Size/1GB,2)}}
        
        return [PSCustomObject]@{
            CPU = [math]::Round($cpu, 1)
            MemoryAvailableMB = [math]::Round($memory, 1)
            DiskFreeGB = $disk.FreeGB
            DiskTotalGB = $disk.TotalGB
        }
    }
    catch {
        return "Error checking system resources: $($_.Exception.Message)"
    }
}

# Function to check network connectivity
function Test-NetworkConnectivity {
    $tests = @(
        @{ Name = "GitHub.com"; Host = "github.com" },
        @{ Name = "Docker Hub"; Host = "registry-1.docker.io" },
        @{ Name = "GitHub Container Registry"; Host = "ghcr.io" }
    )
    
    $results = @()
    foreach ($test in $tests) {
        try {
            $ping = Test-Connection -ComputerName $test.Host -Count 1 -Quiet
            $results += [PSCustomObject]@{
                Service = $test.Name
                Host = $test.Host
                Status = if ($ping) { "✅ Online" } else { "❌ Offline" }
            }
        }
        catch {
            $results += [PSCustomObject]@{
                Service = $test.Name
                Host = $test.Host
                Status = "❌ Error: $($_.Exception.Message)"
            }
        }
    }
    return $results
}

# Function to display monitoring dashboard
function Show-MonitoringDashboard {
    $timestamp = Get-Timestamp
    
    Write-ColorOutput "`n$Cyan╔══════════════════════════════════════════════════════════════════════════════╗$Reset"
    Write-ColorOutput "$Cyan║                    Self-Hosted Runner Monitoring Dashboard                    ║$Reset"
    Write-ColorOutput "$Cyan║                              $timestamp                                    ║$Reset"
    Write-ColorOutput "$Cyan╚══════════════════════════════════════════════════════════════════════════════╝$Reset"
    
    # System Resources
    Write-ColorOutput "`n$Yellow📊 SYSTEM RESOURCES$Reset"
    Write-ColorOutput "$Blue" + "=" * 50$Reset"
    $resources = Get-SystemResources
    if ($resources -is [PSCustomObject]) {
        Write-ColorOutput "CPU Usage: $($resources.CPU)%"
        Write-ColorOutput "Available Memory: $($resources.MemoryAvailableMB) MB"
        Write-ColorOutput "Disk Space: $($resources.DiskFreeGB) GB / $($resources.DiskTotalGB) GB"
    } else {
        Write-ColorOutput $resources
    }
    
    # Network Connectivity
    Write-ColorOutput "`n$Yellow🌐 NETWORK CONNECTIVITY$Reset"
    Write-ColorOutput "$Blue" + "=" * 50$Reset"
    $network = Test-NetworkConnectivity
    foreach ($test in $network) {
        Write-ColorOutput "$($test.Service): $($test.Status)"
    }
    
    # Docker Status
    Write-ColorOutput "`n$Yellow🐳 DOCKER STATUS$Reset"
    Write-ColorOutput "$Blue" + "=" * 50$Reset"
    $dockerRunning = Test-DockerStatus
    if ($dockerRunning) {
        Write-ColorOutput "✅ Docker is running" $Green
    } else {
        Write-ColorOutput "❌ Docker is not running" $Red
    }
    
    # Docker Builds
    Write-ColorOutput "`n$Yellow🔨 ACTIVE DOCKER BUILDS$Reset"
    Write-ColorOutput "$Blue" + "=" * 50$Reset"
    $builds = Get-DockerBuilds
    Write-ColorOutput $builds
    
    # Docker Images
    Write-ColorOutput "`n$Yellow📦 DOCKER IMAGES$Reset"
    Write-ColorOutput "$Blue" + "=" * 50$Reset
    $images = Get-DockerImages
    Write-ColorOutput $images
    
    # Runner Status
    Write-ColorOutput "`n$Yellow🤖 RUNNER STATUS$Reset"
    Write-ColorOutput "$Blue" + "=" * 50$Reset"
    $runner = Get-RunnerStatus
    if ($runner -is [array]) {
        foreach ($r in $runner) {
            Write-ColorOutput "Service: $($r.Name) - Status: $($r.Status)"
        }
    } else {
        Write-ColorOutput $runner
    }
    
    Write-ColorOutput "`n$Cyan" + "=" * 70$Reset
}

# Function to show health check
function Show-HealthCheck {
    Write-ColorOutput "`n$Yellow🏥 RUNNER HEALTH CHECK$Reset"
    Write-ColorOutput "$Blue" + "=" * 50$Reset"
    
    $issues = @()
    
    # Check Docker
    if (-not (Test-DockerStatus)) {
        $issues += "Docker is not running"
    }
    
    # Check system resources
    $resources = Get-SystemResources
    if ($resources -is [PSCustomObject]) {
        if ($resources.CPU -gt 90) {
            $issues += "High CPU usage: $($resources.CPU)%"
        }
        if ($resources.MemoryAvailableMB -lt 1000) {
            $issues += "Low available memory: $($resources.MemoryAvailableMB) MB"
        }
        if ($resources.DiskFreeGB -lt 10) {
            $issues += "Low disk space: $($resources.DiskFreeGB) GB"
        }
    }
    
    # Check network
    $network = Test-NetworkConnectivity
    foreach ($test in $network) {
        if ($test.Status -like "*❌*") {
            $issues += "Network issue: $($test.Service) is not reachable"
        }
    }
    
    if ($issues.Count -eq 0) {
        Write-ColorOutput "✅ All systems healthy!" $Green
    } else {
        Write-ColorOutput "❌ Issues detected:" $Red
        foreach ($issue in $issues) {
            Write-ColorOutput "  • $issue" $Red
        }
    }
}

# Main execution
if ($Health) {
    Show-HealthCheck
} elseif ($DockerOnly) {
    Write-ColorOutput "`n$Yellow🐳 DOCKER MONITORING$Reset"
    Write-ColorOutput "$Blue" + "=" * 50$Reset
    $builds = Get-DockerBuilds
    Write-ColorOutput $builds
    $images = Get-DockerImages
    Write-ColorOutput $images
} elseif ($RunnerOnly) {
    Write-ColorOutput "`n$Yellow🤖 RUNNER MONITORING$Reset"
    Write-ColorOutput "$Blue" + "=" * 50$Reset
    $runner = Get-RunnerStatus
    Write-ColorOutput $runner
} else {
    Show-MonitoringDashboard
}

# Continuous monitoring
if ($Continuous) {
    Write-ColorOutput "`n$Cyan🔄 Starting continuous monitoring (refresh every $Interval seconds)...$Reset"
    Write-ColorOutput "$YellowPress Ctrl+C to stop$Reset"
    
    while ($true) {
        Start-Sleep -Seconds $Interval
        Clear-Host
        Show-MonitoringDashboard
    }
} 