# Visual Test System Launcher
# This script launches the visual test dashboard and optionally runs tests

param(
    [switch]$DashboardOnly,
    [switch]$AutoStart
)

# Function to start dashboard server
function Start-DashboardServer {
    Write-Host "🚀 Starting Visual Test Dashboard Server..." -ForegroundColor Cyan
    
    $job = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        node tests/dashboard-server.js
    }
    
    Write-Host "✅ Dashboard server started (Job ID: $($job.Id))" -ForegroundColor Green
    return $job
}

# Function to open dashboard
function Open-Dashboard {
    Write-Host "📊 Opening dashboard in browser..." -ForegroundColor Cyan
    
    Start-Sleep -Seconds 3
    
            try {
            Start-Process "http://192.168.0.23:3001"
            Write-Host "✅ Dashboard opened in browser" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Could not open dashboard automatically" -ForegroundColor Yellow
            Write-Host "📝 Please open http://192.168.0.23:3001 manually" -ForegroundColor White
        }
}

# Function to start visual tests
function Start-VisualTests {
    Write-Host "🧪 Starting enhanced visual tests..." -ForegroundColor Cyan
    
    $job = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        npx playwright test tests/enhanced-visual-runner.spec.js --project=chromium --headed --reporter=line --timeout=60000 --workers=1
    }
    
    Write-Host "✅ Visual tests started (Job ID: $($job.Id))" -ForegroundColor Green
    return $job
}

# Function to monitor jobs
function Monitor-Jobs {
    param(
        $DashboardJob,
        $TestJob
    )
    
    Write-Host "📊 Monitoring test progress..." -ForegroundColor Cyan
    
    while ($true) {
        $dashboardStatus = Get-Job -Id $DashboardJob.Id -ErrorAction SilentlyContinue
        $testStatus = Get-Job -Id $TestJob.Id -ErrorAction SilentlyContinue
        
        if (-not $dashboardStatus -or $dashboardStatus.State -eq "Failed") {
            Write-Host "❌ Dashboard server stopped unexpectedly" -ForegroundColor Red
            break
        }
        
        if ($testStatus -and $testStatus.State -eq "Completed") {
            Write-Host "✅ Tests completed" -ForegroundColor Green
            break
        }
        
        Start-Sleep -Seconds 5
    }
}

# Function to show results
function Show-Results {
    Write-Host "📊 Test Results:" -ForegroundColor Cyan
    
    if (Test-Path "playwright-report/index.html") {
        Write-Host "  📄 HTML Report: playwright-report/index.html" -ForegroundColor White
        try {
            Start-Process "playwright-report/index.html"
            Write-Host "  ✅ HTML report opened" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️ Could not open HTML report automatically" -ForegroundColor Yellow
        }
    }
    
    $screenshots = Get-ChildItem "test-results/*.png" -ErrorAction SilentlyContinue
    if ($screenshots) {
        Write-Host "  📸 Screenshots: $($screenshots.Count) files in test-results/" -ForegroundColor White
        foreach ($screenshot in $screenshots) {
            Write-Host "    - $($screenshot.Name)" -ForegroundColor Gray
        }
    }
    
    if (Test-Path "test-results/results.json") {
        Write-Host "  📋 JSON Results: test-results/results.json" -ForegroundColor White
    }
}

# Main execution
try {
    # Start dashboard server
    $dashboardJob = Start-DashboardServer
    
    # Open dashboard
    Open-Dashboard
    
    if ($DashboardOnly) {
        Write-Host "🎯 Dashboard only mode - tests will not run automatically" -ForegroundColor Cyan
        Write-Host "📝 Use the dashboard interface to start tests manually" -ForegroundColor White
        Write-Host "🛑 Press Ctrl+C to stop the dashboard server" -ForegroundColor Yellow
        
        # Keep dashboard running
        while ($true) {
            Start-Sleep -Seconds 10
            $status = Get-Job -Id $dashboardJob.Id -ErrorAction SilentlyContinue
            if ($status.State -eq "Failed") {
                Write-Host "❌ Dashboard server stopped unexpectedly" -ForegroundColor Red
                break
            }
        }
    } else {
        if ($AutoStart) {
            # Start tests automatically
            $testJob = Start-VisualTests
            
            # Monitor both jobs
            Monitor-Jobs -DashboardJob $dashboardJob -TestJob $testJob
            
            # Show results
            Show-Results
        } else {
            Write-Host "🎯 Dashboard started successfully!" -ForegroundColor Green
            Write-Host "📝 Use the dashboard interface to start tests" -ForegroundColor White
            Write-Host "🛑 Press Ctrl+C to stop the system" -ForegroundColor Yellow
            
            # Keep running
            while ($true) {
                Start-Sleep -Seconds 10
                $status = Get-Job -Id $dashboardJob.Id -ErrorAction SilentlyContinue
                if ($status.State -eq "Failed") {
                    Write-Host "❌ Dashboard server stopped unexpectedly" -ForegroundColor Red
                    break
                }
            }
        }
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    # Cleanup
    Write-Host "🧹 Cleaning up..." -ForegroundColor Yellow
    
    Get-Job | Where-Object { $_.State -eq "Running" } | Stop-Job
    Get-Job | Remove-Job
    
    Write-Host "✅ Visual testing system stopped" -ForegroundColor Green
}

Write-Host "🏁 Visual testing system completed!" -ForegroundColor Green 