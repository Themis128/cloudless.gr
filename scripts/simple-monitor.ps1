# Simple Self-Hosted Runner Monitor
# Basic monitoring for Windows environments

param(
    [switch]$Continuous,
    [int]$Interval = 10
)

function Show-MonitoringInfo {
    Write-Host "`n🤖 Self-Hosted Runner Quick Monitor" -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

    # Check Docker
    Write-Host "`n🐳 DOCKER STATUS" -ForegroundColor Yellow
    Write-Host "=================" -ForegroundColor Blue
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            Write-Host "✅ Docker is running" -ForegroundColor Green
            Write-Host "Version: $dockerVersion" -ForegroundColor Gray
        } else {
            Write-Host "❌ Docker is not running" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Docker is not running" -ForegroundColor Red
    }

    # Check Docker builds
    Write-Host "`n🔨 ACTIVE DOCKER BUILDS" -ForegroundColor Yellow
    Write-Host "=======================" -ForegroundColor Blue
    try {
        $builds = docker ps --filter "ancestor=ghcr.io/themis128/cloudless.gr" --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}" 2>$null
        if ($builds) {
            Write-Host $builds -ForegroundColor White
        } else {
            Write-Host "No active Docker builds found" -ForegroundColor Gray
        }
    } catch {
        Write-Host "Error checking Docker builds" -ForegroundColor Red
    }

    # Check Runner processes
    Write-Host "`n🤖 RUNNER STATUS" -ForegroundColor Yellow
    Write-Host "================" -ForegroundColor Blue
    try {
        $processes = Get-Process -Name "*runner*" -ErrorAction SilentlyContinue
        if ($processes) {
            foreach ($proc in $processes) {
                Write-Host "Process: $($proc.ProcessName) - PID: $($proc.Id)" -ForegroundColor White
            }
        } else {
            Write-Host "No runner processes found" -ForegroundColor Gray
        }
    } catch {
        Write-Host "Error checking runner processes" -ForegroundColor Red
    }

    # System Info
    Write-Host "`n📊 SYSTEM RESOURCES" -ForegroundColor Yellow
    Write-Host "===================" -ForegroundColor Blue
    try {
        $cpu = Get-Counter "\Processor(_Total)\% Processor Time" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue
        $memory = Get-Counter "\Memory\Available MBytes" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue
        $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object @{Name="FreeGB";Expression={[math]::Round($_.FreeSpace/1GB,2)}}
        
        Write-Host "CPU Usage: $([math]::Round($cpu, 1))%" -ForegroundColor White
        Write-Host "Available Memory: $([math]::Round($memory, 1)) MB" -ForegroundColor White
        Write-Host "Available Disk: $($disk.FreeGB) GB" -ForegroundColor White
    } catch {
        Write-Host "Unable to get system information" -ForegroundColor Red
    }

    Write-Host "`n=====================================" -ForegroundColor Cyan
}

# Main execution
if ($Continuous) {
    Write-Host "🔄 Starting continuous monitoring (refresh every $Interval seconds)..." -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    
    while ($true) {
        Clear-Host
        Show-MonitoringInfo
        Start-Sleep -Seconds $Interval
    }
} else {
    Show-MonitoringInfo
} 