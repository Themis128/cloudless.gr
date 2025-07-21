#!/usr/bin/env pwsh

Write-Host "🚀 GitHub Actions Self-Hosted Runner Manager" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# Configuration
$RunnerDir = "C:\actions-runner"
$RunnerExe = "run.cmd"

# Function to check if runner is already running
function Test-RunnerRunning {
    $processes = Get-Process | Where-Object { 
        $_.ProcessName -like "*runner*" -or 
        $_.ProcessName -like "*actions*" -or 
        $_.ProcessName -like "*Agent*" 
    }
    return $processes.Count -gt 0
}

# Function to check if runner directory exists
function Test-RunnerDirectory {
    if (-not (Test-Path $RunnerDir)) {
        Write-Host "❌ Runner directory not found: $RunnerDir" -ForegroundColor Red
        Write-Host "Please ensure the runner is properly installed." -ForegroundColor Yellow
        return $false
    }
    return $true
}

# Function to check if runner is configured
function Test-RunnerConfigured {
    $configFiles = @(".credentials", ".credentials_rsaparams", ".runner")
    foreach ($file in $configFiles) {
        if (-not (Test-Path "$RunnerDir\$file")) {
            Write-Host "❌ Runner not properly configured. Missing: $file" -ForegroundColor Red
            return $false
        }
    }
    return $true
}

# Function to start the runner
function Start-GitHubRunner {
    Write-Host "🔍 Checking runner status..." -ForegroundColor Cyan
    
    if (-not (Test-RunnerDirectory)) {
        exit 1
    }
    
    if (-not (Test-RunnerConfigured)) {
        Write-Host "❌ Runner is not properly configured!" -ForegroundColor Red
        Write-Host "Please run the setup script first: .\scripts\setup-runner-with-env.ps1" -ForegroundColor Yellow
        exit 1
    }
    
    if (Test-RunnerRunning) {
        Write-Host "⚠️ Runner is already running!" -ForegroundColor Yellow
        Write-Host "Current runner processes:" -ForegroundColor Cyan
        Get-Process | Where-Object { 
            $_.ProcessName -like "*runner*" -or 
            $_.ProcessName -like "*actions*" -or 
            $_.ProcessName -like "*Agent*" 
        } | Format-Table ProcessName, Id, CPU -AutoSize
        return
    }
    
    Write-Host "✅ Runner directory and configuration verified" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Starting GitHub Actions runner..." -ForegroundColor Cyan
    Write-Host "Location: $RunnerDir" -ForegroundColor Gray
    Write-Host "Command: .\$RunnerExe" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Tips:" -ForegroundColor Yellow
    Write-Host "   • Press Ctrl+C to stop the runner" -ForegroundColor White
    Write-Host "   • Runner will automatically pick up new jobs" -ForegroundColor White
    Write-Host "   • Check GitHub Actions page to see job status" -ForegroundColor White
    Write-Host ""
    Write-Host "🎯 Benefits you're getting:" -ForegroundColor Green
    Write-Host "   • Better Performance - Direct access to system resources" -ForegroundColor Green
    Write-Host "   • No Docker Overhead - Faster job execution" -ForegroundColor Green
    Write-Host "   • Simpler Management - No container orchestration" -ForegroundColor Green
    Write-Host "   • GitHub Recommended - Official best practice" -ForegroundColor Green
    Write-Host "   • No Monthly Limits - Completely bypasses GitHub Actions billing" -ForegroundColor Green
    Write-Host ""
    
    try {
        # Change to runner directory and start
        Push-Location $RunnerDir
        Write-Host "📂 Changed to runner directory: $RunnerDir" -ForegroundColor Gray
        
        # Start the runner
        Write-Host "🔄 Starting runner process..." -ForegroundColor Cyan
        & ".\$RunnerExe"
        
    } catch {
        Write-Host "❌ Error starting runner: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    } finally {
        # Return to original directory
        Pop-Location
    }
}

# Function to stop the runner
function Stop-GitHubRunner {
    Write-Host "🛑 Stopping GitHub Actions runner..." -ForegroundColor Cyan
    
    $processes = Get-Process | Where-Object { 
        $_.ProcessName -like "*runner*" -or 
        $_.ProcessName -like "*actions*" -or 
        $_.ProcessName -like "*Agent*" 
    }
    
    if ($processes.Count -eq 0) {
        Write-Host "ℹ️ No runner processes found to stop" -ForegroundColor Yellow
        return
    }
    
    Write-Host "Found $($processes.Count) runner process(es):" -ForegroundColor Cyan
    $processes | Format-Table ProcessName, Id, CPU -AutoSize
    
    foreach ($process in $processes) {
        try {
            Write-Host "🛑 Stopping process: $($process.ProcessName) (ID: $($process.Id))" -ForegroundColor Yellow
            Stop-Process -Id $process.Id -Force
            Write-Host "✅ Stopped process: $($process.ProcessName)" -ForegroundColor Green
        } catch {
            Write-Host "❌ Error stopping process $($process.ProcessName): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host "✅ Runner stopped successfully" -ForegroundColor Green
}

# Function to show runner status
function Show-RunnerStatus {
    Write-Host "📊 GitHub Actions Runner Status" -ForegroundColor Cyan
    Write-Host "==============================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if runner directory exists
    if (Test-RunnerDirectory) {
        Write-Host "✅ Runner Directory: $RunnerDir" -ForegroundColor Green
    } else {
        Write-Host "❌ Runner Directory: Not found" -ForegroundColor Red
        return
    }
    
    # Check if runner is configured
    if (Test-RunnerConfigured) {
        Write-Host "✅ Runner Configuration: Valid" -ForegroundColor Green
    } else {
        Write-Host "❌ Runner Configuration: Invalid" -ForegroundColor Red
        return
    }
    
    # Check if runner is running
    if (Test-RunnerRunning) {
        Write-Host "🟢 Runner Status: Running" -ForegroundColor Green
        Write-Host ""
        Write-Host "Active runner processes:" -ForegroundColor Cyan
        Get-Process | Where-Object { 
            $_.ProcessName -like "*runner*" -or 
            $_.ProcessName -like "*actions*" -or 
            $_.ProcessName -like "*Agent*" 
        } | Format-Table ProcessName, Id, CPU, WorkingSet -AutoSize
    } else {
        Write-Host "🔴 Runner Status: Stopped" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "🌐 GitHub Repository: https://github.com/Themis128/cloudless.gr/settings/actions/runners" -ForegroundColor Cyan
    Write-Host "📋 Actions Page: https://github.com/Themis128/cloudless.gr/actions" -ForegroundColor Cyan
}

# Main execution
param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "status", "restart")]
    [string]$Action = "start"
)

switch ($Action.ToLower()) {
    "start" {
        Start-GitHubRunner
    }
    "stop" {
        Stop-GitHubRunner
    }
    "status" {
        Show-RunnerStatus
    }
    "restart" {
        Write-Host "🔄 Restarting GitHub Actions runner..." -ForegroundColor Cyan
        Stop-GitHubRunner
        Start-Sleep -Seconds 2
        Start-GitHubRunner
    }
    default {
        Write-Host "❌ Invalid action: $Action" -ForegroundColor Red
        Write-Host "Valid actions: start, stop, status, restart" -ForegroundColor Yellow
        exit 1
    }
} 