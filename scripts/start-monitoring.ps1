# Start Monitoring Dashboard
# Opens both PowerShell monitoring and web dashboard

Write-Host "🚀 Starting Self-Hosted Runner Monitoring..." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan

# Open web dashboard
Write-Host "`n🌐 Opening web dashboard..." -ForegroundColor Yellow
try {
    Start-Process "scripts/monitor-runner-web.html"
    Write-Host "✅ Web dashboard opened successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to open web dashboard: $($_.Exception.Message)" -ForegroundColor Red
}

# Wait a moment for the browser to open
Start-Sleep -Seconds 2

# Ask user if they want PowerShell monitoring too
Write-Host "`n🤖 PowerShell Monitoring Options:" -ForegroundColor Cyan
Write-Host "1. Basic monitoring (one-time)" -ForegroundColor White
Write-Host "2. Continuous monitoring (auto-refresh)" -ForegroundColor White
Write-Host "3. Skip PowerShell monitoring" -ForegroundColor White

$choice = Read-Host "`nEnter your choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host "`n📊 Starting basic PowerShell monitoring..." -ForegroundColor Yellow
        & "$PSScriptRoot\simple-monitor.ps1"
    }
    "2" {
        Write-Host "`n🔄 Starting continuous PowerShell monitoring..." -ForegroundColor Yellow
        $interval = Read-Host "Enter refresh interval in seconds (default: 10)"
        if (-not $interval) { $interval = 10 }
        & "$PSScriptRoot\simple-monitor.ps1" -Continuous -Interval $interval
    }
    "3" {
        Write-Host "`n✅ Web dashboard is ready! PowerShell monitoring skipped." -ForegroundColor Green
    }
    default {
        Write-Host "`n❌ Invalid choice. Web dashboard is ready!" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Monitoring setup complete!" -ForegroundColor Green
Write-Host "Web dashboard: scripts/monitor-runner-web.html" -ForegroundColor Gray
Write-Host "PowerShell monitor: scripts/simple-monitor.ps1" -ForegroundColor Gray 