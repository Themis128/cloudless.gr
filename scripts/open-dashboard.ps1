# Quick Web Dashboard Opener
# Automatically opens the monitoring dashboard in your default browser

Write-Host "🌐 Opening Self-Hosted Runner Monitoring Dashboard..." -ForegroundColor Green

try {
    $dashboardPath = Join-Path $PSScriptRoot "monitor-runner-web.html"
    Start-Process $dashboardPath
    Write-Host "✅ Dashboard opened successfully!" -ForegroundColor Green
    Write-Host "📊 The dashboard will auto-refresh every 30 seconds" -ForegroundColor Cyan
    Write-Host "🔄 You can pause/resume auto-refresh using the buttons" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to open dashboard: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Try opening manually: scripts/monitor-runner-web.html" -ForegroundColor Yellow
} 