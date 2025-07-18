# PowerShell Integration Test Script

Write-Host "🚀 Starting integration test..." -ForegroundColor Green

# Start server and redirect output to log
Write-Host "📦 Starting server from build output..." -ForegroundColor Yellow
$serverProcess = Start-Process -FilePath "node" -ArgumentList ".output/server/index.mjs" -RedirectStandardOutput "server.log" -RedirectStandardError "server-error.log" -PassThru -WindowStyle Hidden

# Wait briefly for server to attempt startup
Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if server is still running
if ($serverProcess -and -not $serverProcess.HasExited) {
    Write-Host "✅ Server is still running (PID: $($serverProcess.Id))" -ForegroundColor Green
    # Wait a bit more for full startup
    Start-Sleep -Seconds 10
} else {
    Write-Host "❌ Server crashed. Logs:" -ForegroundColor Red
    if (Test-Path "server.log") {
        Write-Host "📋 Standard output:" -ForegroundColor Yellow
        Get-Content "server.log"
    }
    if (Test-Path "server-error.log") {
        Write-Host "📋 Error output:" -ForegroundColor Yellow
        Get-Content "server-error.log"
    }
    Write-Host "📊 Checking if any node processes are running:" -ForegroundColor Yellow
    Get-Process | Where-Object {$_.ProcessName -eq "node"}
    exit 1
}

# Test if server is responding - try multiple approaches
Write-Host "🔍 Testing server response..." -ForegroundColor Yellow

$serverResponding = $false

# Try different server variants
$urls = @(
    "http://192.168.0.23:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
)

foreach ($url in $urls) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Server is responding on $url" -ForegroundColor Green
            $serverResponding = $true
            break
        }
    }
    catch {
        Write-Host "❌ Failed to connect to $url" -ForegroundColor Red
    }
}

if (-not $serverResponding) {
    Write-Host "❌ Server is not responding to any localhost variant" -ForegroundColor Red
    Write-Host "📊 Checking server status..." -ForegroundColor Yellow
    Get-Process | Where-Object {$_.ProcessName -eq "node"}
    Write-Host "📊 Checking port 3000..." -ForegroundColor Yellow
    netstat -an | Select-String ":3000"
    Write-Host "📊 Checking server process..." -ForegroundColor Yellow
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Write-Host "Server process is still running (PID: $($serverProcess.Id))" -ForegroundColor Yellow
    } else {
        Write-Host "Server process has stopped" -ForegroundColor Red
    }
    exit 1
}

# Kill server
Write-Host "🛑 Stopping server..." -ForegroundColor Yellow
if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
}

Write-Host "✅ Integration test passed" -ForegroundColor Green 