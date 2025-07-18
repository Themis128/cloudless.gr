# PowerShell Integration Test Script

Write-Host "🚀 Starting integration test..." -ForegroundColor Green

# Start server in background, redirect output to log
Write-Host "📦 Launching server..." -ForegroundColor Yellow
$serverProcess = Start-Process -FilePath "node" -ArgumentList ".output/server/index.mjs", "--hostname=0.0.0.0" -RedirectStandardOutput "server.log" -RedirectStandardError "server-error.log" -PassThru -WindowStyle Hidden
Write-Host "Server PID: $($serverProcess.Id)" -ForegroundColor Cyan

# Give the server time to initialize
Start-Sleep -Seconds 5

# Check if the server is still running
if ($serverProcess -and -not $serverProcess.HasExited) {
    Write-Host "✅ Server is still running" -ForegroundColor Green
} else {
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

# Try connecting via IPv4 and IPv6
Write-Host "🔍 Testing server response..." -ForegroundColor Yellow

$serverResponding = $false
$urls = @("http://127.0.0.1:3000", "http://localhost:3000", "http://[::1]:3000")

foreach ($url in $urls) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Server responded successfully on $url" -ForegroundColor Green
            $serverResponding = $true
            break
        }
    }
    catch {
        Write-Host "❌ Failed to connect to $url" -ForegroundColor Red
    }
}

if (-not $serverResponding) {
    Write-Host "❌ Server didn't respond correctly. Logs:" -ForegroundColor Red
    if (Test-Path "server.log") {
        Get-Content "server.log"
    }
    
    Write-Host "📊 Process check:" -ForegroundColor Yellow
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Write-Host "Process $($serverProcess.Id) is still running" -ForegroundColor Yellow
    } else {
        Write-Host "Process $($serverProcess.Id) not found" -ForegroundColor Red
    }
    
    Write-Host "📊 Port 3000 status:" -ForegroundColor Yellow
    netstat -an | Select-String ":3000" || Write-Host "No listener on port 3000" -ForegroundColor Red
    
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
    }
    exit 1
}

# Clean up
if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
}
Write-Host "✅ Integration test passed!" -ForegroundColor Green 