#!/usr/bin/env pwsh

# 📊 Optimized Runner Monitoring
# Monitors runner performance, health, and resource usage

param(
    [ValidateSet("status", "health", "performance", "logs", "metrics", "watch")]
    [string]$Action = "status",
    [int]$Duration = 60,
    [switch]$Continuous = $false
)

Write-Host "📊 Optimized Runner Monitoring" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""

# Configuration
$RunnerContainer = "cloudless-github-runner-optimized"
$HealthUrl = "http://localhost:8080/health"
$LogFile = ".\runner-logs\runner-monitor.log"

# Function to get runner status
function Get-RunnerStatus {
    Write-Host "🔍 Runner Status" -ForegroundColor Cyan
    Write-Host "===============" -ForegroundColor Cyan
    
    try {
        # Container status
        $containerInfo = docker ps --filter "name=$RunnerContainer" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Size}}"
        if ($containerInfo) {
            Write-Host "🐳 Container Status:" -ForegroundColor White
            Write-Host $containerInfo -ForegroundColor Gray
        } else {
            Write-Host "❌ Runner container not found" -ForegroundColor Red
            return $false
        }
        
        # Health check
        try {
            $healthResponse = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 5
            if ($healthResponse.StatusCode -eq 200) {
                Write-Host "✅ Health Check: PASSED" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Health Check: UNKNOWN (Status: $($healthResponse.StatusCode))" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ Health Check: FAILED" -ForegroundColor Red
        }
        
        return $true
        
    } catch {
        Write-Host "❌ Could not get runner status: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to check runner health
function Test-RunnerHealth {
    Write-Host "🏥 Runner Health Check" -ForegroundColor Cyan
    Write-Host "=====================" -ForegroundColor Cyan
    
    $healthChecks = @{
        "Container Running" = $false
        "Health Endpoint" = $false
        "Docker Socket" = $false
        "Resource Usage" = $false
        "Network Connectivity" = $false
    }
    
    # Check if container is running
    try {
        $containerStatus = docker ps --filter "name=$RunnerContainer" --format "{{.Status}}"
        if ($containerStatus -and $containerStatus -like "*Up*") {
            $healthChecks["Container Running"] = $true
            Write-Host "✅ Container Running" -ForegroundColor Green
        } else {
            Write-Host "❌ Container Not Running" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Container Check Failed" -ForegroundColor Red
    }
    
    # Check health endpoint
    try {
        $healthResponse = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 5
        if ($healthResponse.StatusCode -eq 200) {
            $healthChecks["Health Endpoint"] = $true
            Write-Host "✅ Health Endpoint" -ForegroundColor Green
        } else {
            Write-Host "❌ Health Endpoint (Status: $($healthResponse.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Health Endpoint Failed" -ForegroundColor Red
    }
    
    # Check Docker socket access
    try {
        docker version | Out-Null
        $healthChecks["Docker Socket"] = $true
        Write-Host "✅ Docker Socket" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker Socket Failed" -ForegroundColor Red
    }
    
    # Check resource usage
    try {
        $stats = docker stats --no-stream --format "{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" $RunnerContainer
        if ($stats) {
            $healthChecks["Resource Usage"] = $true
            Write-Host "✅ Resource Usage" -ForegroundColor Green
            Write-Host "  📊 $stats" -ForegroundColor Gray
        } else {
            Write-Host "❌ Resource Usage Check Failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Resource Usage Check Failed" -ForegroundColor Red
    }
    
    # Check network connectivity
    try {
        $pingResult = Test-NetConnection -ComputerName "github.com" -Port 443 -InformationLevel Quiet
        if ($pingResult) {
            $healthChecks["Network Connectivity"] = $true
            Write-Host "✅ Network Connectivity" -ForegroundColor Green
        } else {
            Write-Host "❌ Network Connectivity Failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Network Connectivity Check Failed" -ForegroundColor Red
    }
    
    # Overall health score
    $passedChecks = ($healthChecks.Values | Where-Object { $_ -eq $true }).Count
    $totalChecks = $healthChecks.Count
    $healthScore = [math]::Round(($passedChecks / $totalChecks) * 100, 1)
    
    Write-Host ""
    Write-Host "📈 Health Score: $healthScore% ($passedChecks/$totalChecks checks passed)" -ForegroundColor Cyan
    
    if ($healthScore -eq 100) {
        Write-Host "🎉 Runner is healthy!" -ForegroundColor Green
    } elseif ($healthScore -ge 80) {
        Write-Host "⚠️ Runner has minor issues" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Runner has significant issues" -ForegroundColor Red
    }
    
    return $healthScore
}

# Function to get performance metrics
function Get-PerformanceMetrics {
    Write-Host "⚡ Performance Metrics" -ForegroundColor Cyan
    Write-Host "=====================" -ForegroundColor Cyan
    
    try {
        # Get container stats
        $stats = docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
        Write-Host "📊 Container Stats:" -ForegroundColor White
        Write-Host $stats -ForegroundColor Gray
        
        # Get system resources
        Write-Host ""
        Write-Host "💻 System Resources:" -ForegroundColor White
        
        # CPU usage
        $cpuUsage = Get-Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 1
        $cpuPercent = [math]::Round($cpuUsage.CounterSamples[0].CookedValue, 1)
        Write-Host "  • CPU Usage: ${cpuPercent}%" -ForegroundColor Gray
        
        # Memory usage
        $memory = Get-Counter "\Memory\Available MBytes" -SampleInterval 1 -MaxSamples 1
        $availableMB = [math]::Round($memory.CounterSamples[0].CookedValue, 0)
        $totalMemory = [math]::Round((Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory / 1MB, 0)
        $usedMemory = $totalMemory - $availableMB
        $memoryPercent = [math]::Round(($usedMemory / $totalMemory) * 100, 1)
        Write-Host "  • Memory Usage: ${memoryPercent}% (${usedMemory}MB / ${totalMemory}MB)" -ForegroundColor Gray
        
        # Disk usage
        $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
        $diskPercent = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 1)
        $freeGB = [math]::Round($disk.FreeSpace / 1GB, 1)
        Write-Host "  • Disk Usage: ${diskPercent}% (${freeGB}GB free)" -ForegroundColor Gray
        
        # Network usage
        $network = Get-Counter "\Network Interface(*)\Bytes Total/sec" -SampleInterval 1 -MaxSamples 1
        $networkBytes = $network.CounterSamples | Where-Object { $_.InstanceName -notlike "*isatap*" } | Measure-Object -Property CookedValue -Sum
        $networkMB = [math]::Round($networkBytes.Sum / 1MB, 2)
        Write-Host "  • Network: ${networkMB}MB/s" -ForegroundColor Gray
        
    } catch {
        Write-Host "❌ Could not get performance metrics: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to show recent logs
function Show-RunnerLogs {
    Write-Host "📋 Recent Runner Logs" -ForegroundColor Cyan
    Write-Host "====================" -ForegroundColor Cyan
    
    try {
        # Get container logs
        $logs = docker logs --tail 20 $RunnerContainer 2>&1
        if ($logs) {
            Write-Host $logs -ForegroundColor Gray
        } else {
            Write-Host "No recent logs found" -ForegroundColor Yellow
        }
        
        # Check log file if exists
        if (Test-Path $LogFile) {
            Write-Host ""
            Write-Host "📄 Log File (last 10 lines):" -ForegroundColor White
            $fileLogs = Get-Content $LogFile -Tail 10
            Write-Host $fileLogs -ForegroundColor Gray
        }
        
    } catch {
        Write-Host "❌ Could not get logs: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to get detailed metrics
function Get-DetailedMetrics {
    Write-Host "📈 Detailed Metrics" -ForegroundColor Cyan
    Write-Host "==================" -ForegroundColor Cyan
    
    try {
        # Container metrics
        $containerMetrics = docker stats --no-stream --format "json" $RunnerContainer | ConvertFrom-Json
        Write-Host "🐳 Container Metrics:" -ForegroundColor White
        Write-Host "  • CPU: $($containerMetrics.CPUPerc)" -ForegroundColor Gray
        Write-Host "  • Memory: $($containerMetrics.MemUsage) ($($containerMetrics.MemPerc))" -ForegroundColor Gray
        Write-Host "  • Network I/O: $($containerMetrics.NetIO)" -ForegroundColor Gray
        Write-Host "  • Block I/O: $($containerMetrics.BlockIO)" -ForegroundColor Gray
        
        # Cache metrics
        $cacheDir = ".\runner-cache"
        if (Test-Path $cacheDir) {
            $cacheSize = (Get-ChildItem $cacheDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
            $cacheSizeMB = [math]::Round($cacheSize / 1MB, 2)
            Write-Host ""
            Write-Host "💾 Cache Metrics:" -ForegroundColor White
            Write-Host "  • Total Size: ${cacheSizeMB}MB" -ForegroundColor Gray
            
            # Cache breakdown
            $cacheTypes = @("npm", "docker", "nuxt", "playwright", "build")
            foreach ($type in $cacheTypes) {
                $typePath = Join-Path $cacheDir $type
                if (Test-Path $typePath) {
                    $typeSize = (Get-ChildItem $typePath -Recurse -File | Measure-Object -Property Length -Sum).Sum
                    $typeSizeMB = [math]::Round($typeSize / 1MB, 2)
                    Write-Host "  • $type`: ${typeSizeMB}MB" -ForegroundColor Gray
                }
            }
        }
        
        # Process metrics
        Write-Host ""
        Write-Host "🔄 Process Metrics:" -ForegroundColor White
        $dockerProcesses = Get-Process | Where-Object { $_.ProcessName -like "*docker*" -or $_.ProcessName -like "*runner*" }
        foreach ($process in $dockerProcesses | Select-Object -First 5) {
            $memoryMB = [math]::Round($process.WorkingSet / 1MB, 1)
            Write-Host "  • $($process.ProcessName): ${memoryMB}MB" -ForegroundColor Gray
        }
        
    } catch {
        Write-Host "❌ Could not get detailed metrics: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to watch runner continuously
function Watch-Runner {
    Write-Host "👀 Watching Runner (Press Ctrl+C to stop)" -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor Cyan
    
    $startTime = Get-Date
    $iteration = 0
    
    try {
        while ($true) {
            $iteration++
            $elapsed = (Get-Date) - $startTime
            
            Clear-Host
            Write-Host "📊 Runner Monitor - Iteration $iteration" -ForegroundColor Green
            Write-Host "Elapsed: $($elapsed.ToString('hh\:mm\:ss'))" -ForegroundColor Gray
            Write-Host "Time: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray
            Write-Host ""
            
            # Get quick status
            $isRunning = docker ps --filter "name=$RunnerContainer" --format "{{.Status}}" | Out-String
            if ($isRunning.Trim()) {
                Write-Host "✅ Runner Status: $($isRunning.Trim())" -ForegroundColor Green
            } else {
                Write-Host "❌ Runner Status: Not Running" -ForegroundColor Red
            }
            
            # Get resource usage
            $stats = docker stats --no-stream --format "{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" $RunnerContainer 2>$null
            if ($stats) {
                $cpu, $mem, $memPercent = $stats -split "`t"
                Write-Host "📈 Resources: CPU $cpu, Memory $mem ($memPercent)" -ForegroundColor Cyan
            }
            
            # Health check
            try {
                $healthResponse = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 2 -ErrorAction Stop
                Write-Host "🏥 Health: ✅ OK" -ForegroundColor Green
            } catch {
                Write-Host "🏥 Health: ❌ FAILED" -ForegroundColor Red
            }
            
            Write-Host ""
            Write-Host "Press Ctrl+C to stop monitoring..." -ForegroundColor Yellow
            
            Start-Sleep -Seconds 5
        }
    } catch {
        Write-Host ""
        Write-Host "👋 Monitoring stopped" -ForegroundColor Green
    }
}

# Main execution
try {
    switch ($Action.ToLower()) {
        "status" {
            Get-RunnerStatus
        }
        "health" {
            Test-RunnerHealth
        }
        "performance" {
            Get-PerformanceMetrics
        }
        "logs" {
            Show-RunnerLogs
        }
        "metrics" {
            Get-DetailedMetrics
        }
        "watch" {
            Watch-Runner
        }
        default {
            Write-Host "❌ Invalid action: $Action" -ForegroundColor Red
            Write-Host "Valid actions: status, health, performance, logs, metrics, watch" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Monitoring failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎯 Monitoring completed!" -ForegroundColor Green 