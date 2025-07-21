# Debug Server Crash Script
Write-Host "🔍 Debugging Server Crash..." -ForegroundColor Cyan

# Set environment variables
$env:NODE_ENV = "production"
$env:NUXT_HOST = "0.0.0.0"
$env:NUXT_PORT = "3000"
$env:NUXT_PUBLIC_SUPABASE_URL = "https://oflctqligzouzshimuqh.supabase.co"
$env:NUXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MTQ3NDUsImV4cCI6MjA2NDM5MDc0NX0.Z1VgH0O77UM2Zb-J4a3fWNTTSFsfHZFmhsAUKJCJInc"

Write-Host "✅ Environment variables set" -ForegroundColor Green

# Check if server file exists
if (-not (Test-Path ".output/server/index.mjs")) {
    Write-Host "❌ Server file not found. Run 'npm run build' first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Server file found" -ForegroundColor Green

# Create separate log files for stdout and stderr
$stdoutFile = [System.IO.Path]::GetTempFileName()
$stderrFile = [System.IO.Path]::GetTempFileName()
Write-Host "📝 Log files: $stdoutFile, $stderrFile" -ForegroundColor Yellow

# Try to run server and capture all output
Write-Host "🧪 Starting server with detailed logging..." -ForegroundColor Blue

try {
    $process = Start-Process -FilePath "node" -ArgumentList "--trace-uncaught", "--trace-warnings", "--abort-on-uncaught-exception", ".output/server/index.mjs" -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile -PassThru -WindowStyle Hidden
    
    Write-Host "📋 Process started with PID: $($process.Id)" -ForegroundColor Yellow
    
    # Wait a moment for startup
    Start-Sleep -Seconds 2
    
    if ($process.HasExited) {
        Write-Host "❌ Server crashed immediately" -ForegroundColor Red
        Write-Host "📋 Exit code: $($process.ExitCode)" -ForegroundColor Yellow
        
        # Read the log files
        Write-Host "📋 STDOUT:" -ForegroundColor Cyan
        if (Test-Path $stdoutFile) {
            Get-Content $stdoutFile
        }
        else {
            Write-Host "No stdout log file created" -ForegroundColor Red
        }
        
        Write-Host "📋 STDERR:" -ForegroundColor Cyan
        if (Test-Path $stderrFile) {
            Get-Content $stderrFile
        }
        else {
            Write-Host "No stderr log file created" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✅ Server is still running" -ForegroundColor Green
        
        # Wait a bit more and check again
        Start-Sleep -Seconds 3
        
        if ($process.HasExited) {
            Write-Host "❌ Server crashed after 5 seconds" -ForegroundColor Red
            Write-Host "📋 Exit code: $($process.ExitCode)" -ForegroundColor Yellow
            
            # Read the log files
            Write-Host "📋 STDOUT:" -ForegroundColor Cyan
            if (Test-Path $stdoutFile) {
                Get-Content $stdoutFile
            }
            
            Write-Host "📋 STDERR:" -ForegroundColor Cyan
            if (Test-Path $stderrFile) {
                Get-Content $stderrFile
            }
        }
        else {
            Write-Host "✅ Server is stable" -ForegroundColor Green
            
            # Test if it's responding
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -ErrorAction SilentlyContinue
                Write-Host "✅ Server is responding on port 3000" -ForegroundColor Green
                Write-Host "📋 Response status: $($response.StatusCode)" -ForegroundColor Yellow
            }
            catch {
                Write-Host "⚠️ Server is running but not responding on port 3000" -ForegroundColor Yellow
            }
            
            # Stop the server
            if ($process -and -not $process.HasExited) {
                Stop-Process -Id $process.Id -Force
                Write-Host "✅ Server stopped" -ForegroundColor Green
            }
        }
    }
}
catch {
    Write-Host "❌ Error starting server: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    # Cleanup
    if (Test-Path $stdoutFile) {
        Remove-Item $stdoutFile -Force
    }
    if (Test-Path $stderrFile) {
        Remove-Item $stderrFile -Force
    }
}

Write-Host ""
Write-Host "🎉 Test completed!" -ForegroundColor Green
Write-Host "If the server worked locally, the issue is with the CI environment." -ForegroundColor Cyan
Write-Host "Set up GitHub secrets and the CI should work!" -ForegroundColor Cyan 