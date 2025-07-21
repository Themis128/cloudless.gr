# Test Server with Correct Environment Variables
Write-Host "🔍 Testing Server with Correct Environment Variables..." -ForegroundColor Cyan

# Set environment variables with the correct names
$env:NODE_ENV = "production"
$env:NITRO_HOST = "0.0.0.0"
$env:NITRO_PORT = "3001"
$env:NUXT_PUBLIC_SUPABASE_URL = "https://oflctqligzouzshimuqh.supabase.co"
$env:NUXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MTQ3NDUsImV4cCI6MjA2NDM5MDc0NX0.Z1VgH0O77UM2Zb-J4a3fWNTTSFsfHZFmhsAUKJCJInc"

Write-Host "✅ Environment variables set" -ForegroundColor Green
Write-Host "  NITRO_PORT: $env:NITRO_PORT" -ForegroundColor Yellow
Write-Host "  NITRO_HOST: $env:NITRO_HOST" -ForegroundColor Yellow

# Check if server file exists
if (-not (Test-Path ".output/server/index.mjs")) {
    Write-Host "❌ Server file not found. Run 'npm run build' first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Server file found" -ForegroundColor Green

# Create separate log files for stdout and stderr
$stdoutFile = [System.IO.Path]::GetTempFileName()
$stderrFile = [System.IO.Path]::GetTempFileName()

# Try to run server and capture all output
Write-Host "🧪 Starting server with correct environment variables..." -ForegroundColor Blue

try {
    $process = Start-Process -FilePath "node" -ArgumentList "--trace-uncaught", "--trace-warnings", ".output/server/index.mjs" -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile -PassThru -WindowStyle Hidden
    
    Write-Host "📋 Process started with PID: $($process.Id)" -ForegroundColor Yellow
    
    # Wait a moment for startup
    Start-Sleep -Seconds 3
    
    if ($process.HasExited) {
        Write-Host "❌ Server crashed" -ForegroundColor Red
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
        Write-Host "✅ Server is running" -ForegroundColor Green
        
        # Test if it's responding
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 5 -ErrorAction SilentlyContinue
            Write-Host "✅ Server is responding on port 3001!" -ForegroundColor Green
            Write-Host "📋 Response status: $($response.StatusCode)" -ForegroundColor Yellow
            
            # Test health endpoint
            try {
                $healthResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
                Write-Host "✅ Health endpoint responding!" -ForegroundColor Green
            }
            catch {
                Write-Host "⚠️ Health endpoint not responding" -ForegroundColor Yellow
            }
            
        }
        catch {
            Write-Host "⚠️ Server is running but not responding on port 3001" -ForegroundColor Yellow
        }
        
        # Stop the server
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force
            Write-Host "✅ Server stopped" -ForegroundColor Green
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