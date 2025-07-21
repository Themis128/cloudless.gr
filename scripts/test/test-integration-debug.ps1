# PowerShell Integration Test Debug Script
# Comprehensive debugging for the Nuxt.js application

param(
    [int]$Port = 3000,
    [string]$HostAddress = "0.0.0.0"
)

# Function to write colored output
function Write-Status {
    param([string]$Message)
    Write-Host "🔍 $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

Write-Host "🔍 Starting comprehensive integration test debug..." -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "Not in project root directory"
    exit 1
}

Write-Status "Environment check..."
Write-Host "Current directory: $(Get-Location)"
Write-Host "Node version: $(node --version)"
Write-Host "NPM version: $(npm --version)"

# Check if .output exists
if (-not (Test-Path ".output")) {
    Write-Error ".output directory not found. Run 'npm run build' first."
    exit 1
}

# Check if server file exists
if (-not (Test-Path ".output/server/index.mjs")) {
    Write-Error "Server file not found: .output/server/index.mjs"
    exit 1
}

Write-Success "Server file found: .output/server/index.mjs"

# Set environment variables with fallbacks
$env:NODE_ENV = "production"
$env:NUXT_HOST = $HostAddress
$env:NUXT_PORT = $Port
$env:NUXT_PUBLIC_SUPABASE_URL = if ($env:NUXT_PUBLIC_SUPABASE_URL) { $env:NUXT_PUBLIC_SUPABASE_URL } else { "https://test.supabase.co" }
$env:NUXT_PUBLIC_SUPABASE_ANON_KEY = if ($env:NUXT_PUBLIC_SUPABASE_ANON_KEY) { $env:NUXT_PUBLIC_SUPABASE_ANON_KEY } else { "test-key-123456789" }

Write-Status "Environment variables set:"
Write-Host "  NODE_ENV: $env:NODE_ENV"
Write-Host "  NUXT_HOST: $env:NUXT_HOST"
Write-Host "  NUXT_PORT: $env:NUXT_PORT"
Write-Host "  NUXT_PUBLIC_SUPABASE_URL: $env:NUXT_PUBLIC_SUPABASE_URL"
Write-Host "  NUXT_PUBLIC_SUPABASE_ANON_KEY: $($env:NUXT_PUBLIC_SUPABASE_ANON_KEY.Substring(0, [Math]::Min(10, $env:NUXT_PUBLIC_SUPABASE_ANON_KEY.Length)))..."

# Check if port is available
try {
    $portCheck = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($portCheck) {
        Write-Warning "Port $Port is already in use"
        $portCheck | Format-Table -AutoSize
    }
}
catch {
    # Port not in use, which is good
}

# Test 1: Direct Node.js execution with verbose output
Write-Status "Test 1: Direct Node.js execution with verbose output..."
Write-Host "Running: node --trace-warnings .output/server/index.mjs"

# Create a temporary log file
$logFile = [System.IO.Path]::GetTempFileName()
Write-Host "Log file: $logFile"

# Run server with detailed output
$serverProcess = Start-Process -FilePath "node" -ArgumentList "--trace-warnings", ".output/server/index.mjs" -RedirectStandardOutput $logFile -RedirectStandardError $logFile -PassThru -WindowStyle Hidden

# Wait a moment for startup
Start-Sleep -Seconds 2

# Check if process is still running
if ($serverProcess.HasExited) {
    Write-Error "Server process died immediately"
    Write-Host "=== Server Output ==="
    Get-Content $logFile
    Write-Host "===================="
    Remove-Item $logFile -Force
    exit 1
}

Write-Success "Server process started (PID: $($serverProcess.Id))"

# Wait for server to be ready
Write-Status "Waiting for server to be ready..."
$serverReady = $false
for ($i = 1; $i -le 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Success "Server is responding on port $Port"
            $serverReady = $true
            break
        }
    }
    catch {
        # Server not ready yet
    }
    Write-Host "  Attempt $i/10..."
    Start-Sleep -Seconds 1
}

# Test server response
if ($serverReady) {
    Write-Success "Server is working correctly!"
    
    # Test specific endpoints
    Write-Status "Testing endpoints..."
    
    # Test health endpoint
    try {
        $healthResponse = Invoke-WebRequest -Uri "http://localhost:$Port/api/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        Write-Success "Health endpoint responding"
    }
    catch {
        Write-Warning "Health endpoint not responding"
    }
    
    # Test root endpoint
    try {
        $rootResponse = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($rootResponse.StatusCode -eq 200) {
            Write-Success "Root endpoint responding with 200"
        }
        else {
            Write-Warning "Root endpoint responding with $($rootResponse.StatusCode)"
        }
    }
    catch {
        Write-Warning "Root endpoint not responding"
    }
    
}
else {
    Write-Error "Server is not responding"
    Write-Host "=== Server Output ==="
    Get-Content $logFile
    Write-Host "===================="
}

# Cleanup
Write-Status "Cleaning up..."
if (-not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
}
Remove-Item $logFile -Force -ErrorAction SilentlyContinue

Write-Success "Integration test debug completed!" 