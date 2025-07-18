# PowerShell Integration Test Script

Write-Host "🚀 Starting integration test..." -ForegroundColor Green

# Start server directly from build output
Write-Host "📦 Starting server from build output..." -ForegroundColor Yellow
$serverProcess = Start-Process -FilePath "node" -ArgumentList ".output/server/index.mjs" -PassThru -WindowStyle Hidden

# Wait for server to start (increased wait time)
Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Test if server is responding - try multiple approaches
Write-Host "🔍 Testing server response..." -ForegroundColor Yellow

$serverResponding = $false

# Try different localhost variants
$urls = @(
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000"
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