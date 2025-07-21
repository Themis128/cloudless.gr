# Auto-Remediation Script for Self-Hosted Runner
# Automatically fixes common issues detected by the monitoring dashboard

param(
    [switch]$DryRun = $false,
    [switch]$Force = $false,
    [int]$MaxRetries = 3
)

# Colors for output
$Red = "Red"
$Yellow = "Yellow"
$Green = "Green"
$Cyan = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Get-Timestamp {
    return Get-Date -Format "HH:mm:ss"
}

function Test-AdminPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-SafeCommand {
    param(
        [string]$Command,
        [string]$Description,
        [switch]$RequireAdmin = $false
    )
    
    Write-ColorOutput "[$(Get-Timestamp)] 🔧 $Description" $Cyan
    
    if ($RequireAdmin -and -not (Test-AdminPrivileges)) {
        Write-ColorOutput "[$(Get-Timestamp)] ❌ Admin privileges required for: $Command" $Red
        return $false
    }
    
    if ($DryRun) {
        Write-ColorOutput "[$(Get-Timestamp)] 🔍 DRY RUN: Would execute: $Command" $Yellow
        return $true
    }
    
    try {
        $result = Invoke-Expression $Command 2>&1
        Write-ColorOutput "[$(Get-Timestamp)] ✅ Success: $Description" $Green
        if ($result) {
            Write-ColorOutput "   Output: $result" $Cyan
        }
        return $true
    }
    catch {
        Write-ColorOutput "[$(Get-Timestamp)] ❌ Failed: $Description - $($_.Exception.Message)" $Red
        return $false
    }
}

function Repair-HighCPU {
    Write-ColorOutput "[$(Get-Timestamp)] 🚨 Remediating High CPU Usage..." $Yellow
    
    # Check for runaway processes
    Invoke-SafeCommand -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5" -Description "Checking top CPU processes"
    
    # Kill processes using excessive CPU (if Force is enabled)
    if ($Force) {
        $highCPUProcesses = Get-Process | Where-Object { $_.CPU -gt 1000 } | Where-Object { $_.ProcessName -notin @("System", "Idle", "svchost") }
        foreach ($proc in $highCPUProcesses) {
            Write-ColorOutput "[$(Get-Timestamp)] 🔄 Stopping high CPU process: $($proc.ProcessName) (PID: $($proc.Id))" $Yellow
            if (-not $DryRun) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }
    
    # Restart Docker if it's consuming too much CPU
    $dockerProcesses = Get-Process | Where-Object { $_.ProcessName -like "*docker*" }
    if ($dockerProcesses) {
        Invoke-SafeCommand -Command "Restart-Service docker" -Description "Restarting Docker service" -RequireAdmin
    }
}

function Repair-HighMemory {
    Write-ColorOutput "[$(Get-Timestamp)] 🚨 Remediating High Memory Usage..." $Yellow
    
    # Check memory usage
    Invoke-SafeCommand -Command "Get-Counter '\Memory\Available MBytes'" -Description "Checking available memory"
    
    # Clear Docker images if Force is enabled
    if ($Force) {
        Invoke-SafeCommand -Command "docker image prune -a -f" -Description "Cleaning Docker images"
    }
    
    # Restart runner service if it's consuming too much memory
    $runnerProcesses = Get-Process | Where-Object { $_.ProcessName -like "*runner*" -or $_.ProcessName -like "*actions*" }
    if ($runnerProcesses) {
        Invoke-SafeCommand -Command "Get-Service | Where-Object { `$_.Name -like '*actions*' -or `$_.Name -like '*runner*' } | Restart-Service" -Description "Restarting runner services" -RequireAdmin
    }
}

function Repair-HighDisk {
    Write-ColorOutput "[$(Get-Timestamp)] 🚨 Remediating High Disk Usage..." $Yellow
    
    # Check disk usage
    Invoke-SafeCommand -Command "Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, @{Name='Size(GB)';Expression={[math]::Round($_.Size/1GB,2)}}, @{Name='FreeSpace(GB)';Expression={[math]::Round($_.FreeSpace/1GB,2)}}, @{Name='PercentFree';Expression={[math]::Round(($_.FreeSpace/$_.Size)*100,2)}}" -Description "Checking disk usage"
    
    # Clean Docker cache
    Invoke-SafeCommand -Command "docker system prune -f" -Description "Cleaning Docker system cache"
    
    # Clean Docker volumes
    Invoke-SafeCommand -Command "docker volume prune -f" -Description "Cleaning Docker volumes"
    
    # Clean npm cache
    Invoke-SafeCommand -Command "npm cache clean --force" -Description "Cleaning npm cache"
    
    # Clean Windows temp files
    if ($Force) {
        Invoke-SafeCommand -Command "Remove-Item -Path `$env:TEMP\* -Recurse -Force -ErrorAction SilentlyContinue" -Description "Cleaning Windows temp files"
    }
}

function Repair-DockerIssues {
    Write-ColorOutput "[$(Get-Timestamp)] 🚨 Remediating Docker Issues..." $Yellow
    
    # Check Docker service status
    $dockerService = Get-Service -Name "docker" -ErrorAction SilentlyContinue
    if (-not $dockerService) {
        Write-ColorOutput "[$(Get-Timestamp)] ❌ Docker service not found" $Red
        return
    }
    
    if ($dockerService.Status -ne "Running") {
        Invoke-SafeCommand -Command "Start-Service docker" -Description "Starting Docker service" -RequireAdmin
        Invoke-SafeCommand -Command "Set-Service docker -StartupType Automatic" -Description "Setting Docker to auto-start" -RequireAdmin
    }
    
    # Clean Docker resources
    Invoke-SafeCommand -Command "docker system prune -a -f" -Description "Cleaning all Docker resources"
    Invoke-SafeCommand -Command "docker image prune -a -f" -Description "Cleaning Docker images"
    Invoke-SafeCommand -Command "docker container prune -f" -Description "Cleaning stopped containers"
}

function Repair-RunnerIssues {
    Write-ColorOutput "[$(Get-Timestamp)] 🚨 Remediating Runner Issues..." $Yellow
    
    # Check for runner processes
    $runnerProcesses = Get-Process | Where-Object { $_.ProcessName -like "*runner*" -or $_.ProcessName -like "*actions*" }
    
    if (-not $runnerProcesses) {
        Write-ColorOutput "[$(Get-Timestamp)] ⚠️ No runner processes found" $Yellow
        
        # Try to start runner service
        $runnerServices = Get-Service | Where-Object { $_.Name -like "*actions*" -or $_.Name -like "*runner*" }
        foreach ($service in $runnerServices) {
            Invoke-SafeCommand -Command "Start-Service $($service.Name)" -Description "Starting runner service: $($service.Name)" -RequireAdmin
        }
    }
}

function Repair-NetworkIssues {
    Write-ColorOutput "[$(Get-Timestamp)] 🚨 Remediating Network Issues..." $Yellow
    
    # Test basic connectivity
    Invoke-SafeCommand -Command "Test-NetConnection -ComputerName 8.8.8.8 -Port 53" -Description "Testing DNS connectivity"
    Invoke-SafeCommand -Command "Test-NetConnection -ComputerName github.com -Port 443" -Description "Testing GitHub connectivity"
    
    # Flush DNS cache
    Invoke-SafeCommand -Command "ipconfig /flushdns" -Description "Flushing DNS cache" -RequireAdmin
    
    # Reset network adapter if Force is enabled
    if ($Force) {
        $networkAdapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" }
        foreach ($adapter in $networkAdapters) {
            Write-ColorOutput "[$(Get-Timestamp)] 🔄 Resetting network adapter: $($adapter.Name)" $Yellow
            if (-not $DryRun) {
                Disable-NetAdapter -Name $adapter.Name -Confirm:$false -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
                Enable-NetAdapter -Name $adapter.Name -Confirm:$false -ErrorAction SilentlyContinue
            }
        }
    }
}

function Repair-TemperatureIssues {
    Write-ColorOutput "[$(Get-Timestamp)] 🚨 Remediating Temperature Issues..." $Yellow
    
    # Check if we can get temperature info
    try {
        $tempInfo = Get-WmiObject -Namespace "root\wmi" -Class MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue
        if ($tempInfo) {
            Write-ColorOutput "[$(Get-Timestamp)] 🌡️ Current temperature sensors detected" $Cyan
        }
    }
    catch {
        Write-ColorOutput "[$(Get-Timestamp)] ⚠️ Temperature sensors not accessible" $Yellow
    }
    
    # Reduce system load
    if ($Force) {
        Write-ColorOutput "[$(Get-Timestamp)] 🔄 Reducing system load..." $Yellow
        
        # Stop non-essential services
        $nonEssentialServices = @("Themes", "TabletInputService", "WSearch")
        foreach ($service in $nonEssentialServices) {
            $svc = Get-Service -Name $service -ErrorAction SilentlyContinue
            if ($svc -and $svc.Status -eq "Running") {
                Invoke-SafeCommand -Command "Stop-Service $service" -Description "Stopping non-essential service: $service" -RequireAdmin
            }
        }
    }
}

function Get-SystemHealth {
    Write-ColorOutput "[$(Get-Timestamp)] 📊 Assessing System Health..." $Cyan
    
    # CPU Usage
    $cpuUsage = (Get-Counter "\Processor(_Total)\% Processor Time").CounterSamples.CookedValue
    Write-ColorOutput "[$(Get-Timestamp)] CPU Usage: $([math]::Round($cpuUsage, 1))%" $(if ($cpuUsage -gt 80) { $Red } elseif ($cpuUsage -gt 60) { $Yellow } else { $Green })
    
    # Memory Usage
    $memory = Get-Counter "\Memory\Available MBytes"
    $totalMemory = (Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory / 1MB
    $availableMemory = $memory.CounterSamples.CookedValue
    $memoryUsage = (($totalMemory - $availableMemory) / $totalMemory) * 100
    Write-ColorOutput "[$(Get-Timestamp)] Memory Usage: $([math]::Round($memoryUsage, 1))%" $(if ($memoryUsage -gt 80) { $Red } elseif ($memoryUsage -gt 60) { $Yellow } else { $Green })
    
    # Disk Usage
    $disk = Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DeviceID -eq "C:" }
    $diskUsage = (($disk.Size - $disk.FreeSpace) / $disk.Size) * 100
    Write-ColorOutput "[$(Get-Timestamp)] Disk Usage: $([math]::Round($diskUsage, 1))%" $(if ($diskUsage -gt 80) { $Red } elseif ($diskUsage -gt 60) { $Yellow } else { $Green })
    
    # Docker Status
    $dockerService = Get-Service -Name "docker" -ErrorAction SilentlyContinue
    $dockerStatus = if ($dockerService) { $dockerService.Status } else { "Not Found" }
    Write-ColorOutput "[$(Get-Timestamp)] Docker Status: $dockerStatus" $(if ($dockerStatus -eq "Running") { $Green } else { $Red })
    
    return @{
        CPU = $cpuUsage
        Memory = $memoryUsage
        Disk = $diskUsage
        Docker = $dockerStatus
    }
}

function Start-AutoRemediation {
    Write-ColorOutput "[$(Get-Timestamp)] 🤖 Starting Auto-Remediation System..." $Cyan
    Write-ColorOutput "[$(Get-Timestamp)] Mode: $(if ($DryRun) { 'DRY RUN' } else { 'LIVE' })" $(if ($DryRun) { $Yellow } else { $Red })
    Write-ColorOutput "[$(Get-Timestamp)] Force Mode: $(if ($Force) { 'ENABLED' } else { 'DISABLED' })" $(if ($Force) { $Red } else { $Green })
    
    # Get current system health
    $health = Get-SystemHealth
    
    # Determine what needs remediation
    $issues = @()
    
    if ($health.CPU -gt 80) { $issues += "HighCPU" }
    if ($health.Memory -gt 80) { $issues += "HighMemory" }
    if ($health.Disk -gt 80) { $issues += "HighDisk" }
    if ($health.Docker -ne "Running") { $issues += "DockerIssues" }
    
    if ($issues.Count -eq 0) {
        Write-ColorOutput "[$(Get-Timestamp)] ✅ System is healthy! No remediation needed." $Green
        return
    }
    
    Write-ColorOutput "[$(Get-Timestamp)] 🚨 Issues detected: $($issues -join ', ')" $Red
    
    # Perform remediation for each issue
    foreach ($issue in $issues) {
        switch ($issue) {
            "HighCPU" { Repair-HighCPU }
            "HighMemory" { Repair-HighMemory }
            "HighDisk" { Repair-HighDisk }
            "DockerIssues" { Repair-DockerIssues }
        }
        
        # Wait between remediations
        Start-Sleep -Seconds 2
    }
    
    # Check network issues
    Repair-NetworkIssues
    
    # Check temperature issues
    Repair-TemperatureIssues
    
    # Final health check
    Write-ColorOutput "[$(Get-Timestamp)] 📊 Post-Remediation Health Check..." $Cyan
    Get-SystemHealth | Out-Null
    
    Write-ColorOutput "[$(Get-Timestamp)] 🎯 Remediation Complete!" $Green
}

# Main execution
try {
    Start-AutoRemediation
}
catch {
    Write-ColorOutput "[$(Get-Timestamp)] ❌ Auto-remediation failed: $($_.Exception.Message)" $Red
    exit 1
} 