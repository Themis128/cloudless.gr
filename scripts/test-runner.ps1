#!/usr/bin/env pwsh

Write-Host "🧪 GitHub Actions Runner Test" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green
Write-Host ""

# Test 1: Check if runner is running
Write-Host "🔍 Test 1: Checking runner status..." -ForegroundColor Cyan
$processes = Get-Process | Where-Object { 
    $_.ProcessName -like "*runner*" -or 
    $_.ProcessName -like "*actions*" -or 
    $_.ProcessName -like "*Agent*" 
}

if ($processes.Count -gt 0) {
    Write-Host "✅ Runner is running!" -ForegroundColor Green
    Write-Host "Active processes:" -ForegroundColor Cyan
    $processes | Format-Table ProcessName, Id, CPU -AutoSize
} else {
    Write-Host "❌ Runner is not running" -ForegroundColor Red
    Write-Host "💡 Start it with: .\scripts\start-runner.ps1 start" -ForegroundColor Yellow
}

Write-Host ""

# Test 2: Check runner directory
Write-Host "🔍 Test 2: Checking runner installation..." -ForegroundColor Cyan
$runnerDir = "C:\actions-runner"
if (Test-Path $runnerDir) {
    Write-Host "✅ Runner directory exists: $runnerDir" -ForegroundColor Green
    
    # Check configuration files
    $configFiles = @(".credentials", ".credentials_rsaparams", ".runner")
    $allConfigured = $true
    foreach ($file in $configFiles) {
        if (Test-Path "$runnerDir\$file") {
            Write-Host "  ✅ $file" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $file" -ForegroundColor Red
            $allConfigured = $false
        }
    }
    
    if ($allConfigured) {
        Write-Host "✅ Runner is properly configured" -ForegroundColor Green
    } else {
        Write-Host "❌ Runner needs configuration" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Runner directory not found" -ForegroundColor Red
}

Write-Host ""

# Test 3: Check recent logs
Write-Host "🔍 Test 3: Checking recent activity..." -ForegroundColor Cyan
$logDir = "$runnerDir\_diag"
if (Test-Path $logDir) {
    $latestLog = Get-ChildItem $logDir -Name "*.log" | Sort-Object -Descending | Select-Object -First 1
    if ($latestLog) {
        Write-Host "✅ Found log file: $latestLog" -ForegroundColor Green
        Write-Host "Recent activity:" -ForegroundColor Cyan
        Get-Content "$logDir\$latestLog" -Tail 5 | ForEach-Object {
            if ($_ -match "Running job|completed with result|Connected to GitHub") {
                Write-Host "  📋 $_" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "⚠️ No log files found" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️ Log directory not found" -ForegroundColor Yellow
}

Write-Host ""

# Test 4: Show usage instructions
Write-Host "📋 Usage Instructions:" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 Start runner:   .\scripts\start-runner.ps1 start" -ForegroundColor Green
Write-Host "🛑 Stop runner:    .\scripts\start-runner.ps1 stop" -ForegroundColor Red
Write-Host "📊 Check status:   .\scripts\start-runner.ps1 status" -ForegroundColor Blue
Write-Host "🔄 Restart runner: .\scripts\start-runner.ps1 restart" -ForegroundColor Yellow
Write-Host ""
Write-Host "🌐 Monitor online:" -ForegroundColor Cyan
Write-Host "   • GitHub Actions: https://github.com/Themis128/cloudless.gr/actions" -ForegroundColor Blue
Write-Host "   • Runner Settings: https://github.com/Themis128/cloudless.gr/settings/actions/runners" -ForegroundColor Blue
Write-Host ""
Write-Host "🎯 Benefits you're getting:" -ForegroundColor Green
Write-Host "   • Better Performance - Direct access to system resources" -ForegroundColor Green
Write-Host "   • No Docker Overhead - Faster job execution" -ForegroundColor Green
Write-Host "   • Simpler Management - No container orchestration" -ForegroundColor Green
Write-Host "   • GitHub Recommended - Official best practice" -ForegroundColor Green
Write-Host "   • No Monthly Limits - Completely bypasses GitHub Actions billing" -ForegroundColor Green 