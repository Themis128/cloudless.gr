# PowerShell Integration Test Script

Write-Host "🚀 Starting integration test..." -ForegroundColor Green
Write-Host "📦 Launching server..." -ForegroundColor Yellow

# Start server and capture output
$serverProcess = Start-Process -FilePath "node" -ArgumentList ".output/server/index.mjs", "--hostname=0.0.0.0" -RedirectStandardOutput "server.log" -RedirectStandardError "server-error.log" -PassThru -WindowStyle Hidden
Write-Host "Server PID: $($serverProcess.Id)" -ForegroundColor Cyan

# Wait briefly for the server to try starting
Start-Sleep -Seconds 5

# Check if server crashed
if (-not $serverProcess -or $serverProcess.HasExited) {
    Write-Host "❌ Server crashed during startup. Here are the logs:" -ForegroundColor Red
    if (Test-Path "server.log") {
        Write-Host "📋 Standard output:" -ForegroundColor Yellow
        Get-Content "server.log"
    }
    if (Test-Path "server-error.log") {
        Write-Host "📋 Error output:" -ForegroundColor Yellow
        Get-Content "server-error.log"
    }
    exit 1
}

# Try curl against localhost
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Server is responding" -ForegroundColor Green
    } else {
        throw "Unexpected status code: $($response.StatusCode)"
    }
}
catch {
    Write-Host "❌ Server is not responding" -ForegroundColor Red
    if (Test-Path "server.log") {
        Get-Content "server.log"
    }
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
    }
    exit 1
}

# Kill server after test
if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
}
Write-Host "✅ Integration test passed" -ForegroundColor Green 