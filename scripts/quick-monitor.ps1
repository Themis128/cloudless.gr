#!/usr/bin/env pwsh

# Quick Self-Hosted Runner Monitor
# Simple monitoring script for Windows environments

param(
    [switch]$Continuous,
    [int]$Interval = 10
)

# Colors
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Cyan = "`e[36m"
$Reset = "`e[0m"

function Write-Color {
    param([string]$Message, [string]$Color = $Reset)
    Write-Host "$Color$Message$Reset"
}

function Get-Timestamp {
    return Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

function Test-Docker {
    try {
        $null = docker --version 2>$null
        return $true
    }
    catch {
        return $false
    }
}

function Get-DockerBuilds {
    if (Test-Docker) {
        try {
            $builds = docker ps --filter "ancestor=ghcr.io/themis128/cloudless.gr" --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}" 2>$null
            if ($builds) {
                return $builds
            }
            return "No active Docker builds found"
        }
        catch {
            return "Error checking Docker builds"
        }
    }
    return "Docker is not running"
}

function Get-RunnerProcesses {
    try {
        $processes = Get-Process -Name "*runner*" -ErrorAction SilentlyContinue
        if ($processes) {
            return $processes | ForEach-Object {
                "Process: $($_.ProcessName) (PID: $($_.Id))"
            }
        }
        return "No runner processes found"
    }
    catch {
        return "Error checking runner processes"
    }
}

function Get-SystemInfo {
    try {
        $cpu = Get-Counter "\Processor(_Total)\% Processor Time" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue
        $memory = Get-Counter "\Memory\Available MBytes" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue
        $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object @{Name="FreeGB";Expression={[math]::Round($_.FreeSpace/1GB,2)}}
        
        return @{
            CPU = [math]::Round($cpu, 1)
            MemoryMB = [math]::Round($memory, 1)
            DiskGB = $disk.FreeGB
        }
    }
    catch {
        return $null
    }
}

function Show-Dashboard {
    $timestamp = Get-Timestamp
    
    Write-Color "`n$Cyan╔══════════════════════════════════════════════════════════════════════════════╗$Reset"
    Write-Color "$Cyan║                    Self-Hosted Runner Quick Monitor                          ║$Reset"
    Write-Color "$Cyan║                              $timestamp                                    ║$Reset"
    Write-Color "$Cyan╚══════════════════════════════════════════════════════════════════════════════╝$Reset"
    
    # System Info
    Write-Color "`n$Yellow📊 SYSTEM RESOURCES$Reset"
    Write-Color "$Blue" + "=" * 50$Reset"
    $sysInfo = Get-SystemInfo
    if ($sysInfo) {
        Write-Color "CPU Usage: $($sysInfo.CPU)%"
        Write-Color "Available Memory: $($sysInfo.MemoryMB) MB"
        Write-Color "Available Disk: $($sysInfo.DiskGB) GB"
    } else {
        Write-Color "Unable to get system information"
    }
    
    # Docker Status
    Write-Color "`n$Yellow🐳 DOCKER STATUS$Reset"
    Write-Color "$Blue" + "=" * 50$Reset"
    if (Test-Docker) {
        Write-Color "✅ Docker is running" $Green
    } else {
        Write-Color "❌ Docker is not running" $Red
    }
    
    # Docker Builds
    Write-Color "`n$Yellow🔨 ACTIVE DOCKER BUILDS$Reset"
    Write-Color "$Blue" + "=" * 50$Reset"
    $builds = Get-DockerBuilds
    Write-Color $builds
    
    # Runner Status
    Write-Color "`n$Yellow🤖 RUNNER STATUS$Reset"
    Write-Color "$Blue" + "=" * 50$Reset"
    $runner = Get-RunnerProcesses
    Write-Color $runner
    
    Write-Color "`n$Cyan" + "=" * 70$Reset
}

# Main execution
if ($Continuous) {
    Write-Color "`n$Cyan🔄 Starting continuous monitoring (refresh every $Interval seconds)...$Reset"
    Write-Color "$Yellow Press Ctrl+C to stop$Reset"
    
    while ($true) {
        Clear-Host
        Show-Dashboard
        Start-Sleep -Seconds $Interval
    }
} else {
    Show-Dashboard
} 