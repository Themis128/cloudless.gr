# Comprehensive Nitro Server Debug Script (PowerShell)
param(
    [string]$Port = "3000",
    [string]$HostAddress = "0.0.0.0"
)

Write-Host "🔍 Comprehensive Nitro Server Debug (PowerShell)" -ForegroundColor Blue

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "❌ Not in project root directory"
    exit 1
}

Write-Status "📋 Environment check..."
Write-Host "Current directory: $(Get-Location)"
Write-Host "Node version: $(node --version)"
Write-Host "NPM version: $(npm --version)"

# Check if .output exists
if (-not (Test-Path ".output")) {
    Write-Error "❌ .output directory not found. Run 'npm run build' first."
    exit 1
}

# Check if server file exists
if (-not (Test-Path ".output/server/index.mjs")) {
    Write-Error "❌ Server file not found: .output/server/index.mjs"
    exit 1
}

Write-Success "✅ Server file found: .output/server/index.mjs"

# Set environment variables with fallbacks
$env:NODE_ENV = "production"
$env:NITRO_HOST = $HostAddress
$env:NITRO_PORT = $Port
$env:NITRO_LOG_LEVEL = "debug"
$env:NUXT_PUBLIC_SUPABASE_URL = if ($env:NUXT_PUBLIC_SUPABASE_URL) { $env:NUXT_PUBLIC_SUPABASE_URL } else { "https://test.supabase.co" }
$env:NUXT_PUBLIC_SUPABASE_ANON_KEY = if ($env:NUXT_PUBLIC_SUPABASE_ANON_KEY) { $env:NUXT_PUBLIC_SUPABASE_ANON_KEY } else { "test-key-123456789" }

Write-Status "🔧 Environment variables set:"
Write-Host "  NODE_ENV: $env:NODE_ENV"
Write-Host "  NITRO_HOST: $env:NITRO_HOST"
Write-Host "  NITRO_PORT: $env:NITRO_PORT"
Write-Host "  NITRO_LOG_LEVEL: $env:NITRO_LOG_LEVEL"
Write-Host "  NUXT_PUBLIC_SUPABASE_URL: $env:NUXT_PUBLIC_SUPABASE_URL"
Write-Host "  NUXT_PUBLIC_SUPABASE_ANON_KEY: $($env:NUXT_PUBLIC_SUPABASE_ANON_KEY.Substring(0, [Math]::Min(10, $env:NUXT_PUBLIC_SUPABASE_ANON_KEY.Length)))..."

# Print all environment variables for debugging
Write-Status "🔍 All environment variables:"
Get-ChildItem Env: | Where-Object { $_.Name -match "(NITRO|NUXT|SUPABASE|NODE)" } | Sort-Object Name | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Value)"
}

# Check for .env file
Write-Status "🔍 Checking for .env file..."
if (Test-Path ".env") {
    Write-Success "✅ .env file found"
    Write-Host "First 5 lines of .env:"
    Get-Content ".env" | Select-Object -First 5
}
else {
    Write-Warning "⚠️  No .env file found"
}

# Check nuxt.config.ts
Write-Status "🔍 Checking nuxt.config.ts..."
if (Test-Path "nuxt.config.ts") {
    Write-Success "✅ nuxt.config.ts found"
    $lineCount = (Get-Content "nuxt.config.ts").Count
    Write-Host "Config file size: $lineCount lines"
}
else {
    Write-Error "❌ nuxt.config.ts not found"
}

# Check file permissions and dependencies
Write-Status "🔍 Checking file permissions and dependencies..."
Write-Host "Server file info:"
Get-ChildItem ".output/server/index.mjs" | Select-Object Name, Length, LastWriteTime

if (Test-Path ".output/server/node_modules") {
    Write-Host "Node modules (first 10):"
    Get-ChildItem ".output/server/node_modules" | Select-Object -First 10 Name
}

Write-Host "Package.json exists: $(if (Test-Path '.output/server/package.json') { 'Yes' } else { 'No' })"

# Check for critical dependencies
Write-Status "🔍 Checking critical dependencies..."
if (Test-Path ".output/server/package.json") {
    Write-Host "Critical dependencies check:"
    $packageContent = Get-Content ".output/server/package.json" -Raw
    
    if ($packageContent -match '"h3"') {
        Write-Success "✅ h3 found"
    }
    else {
        Write-Error "❌ h3 missing"
    }
    
    if ($packageContent -match '"nitro"') {
        Write-Success "✅ nitro found"
    }
    else {
        Write-Error "❌ nitro missing"
    }
    
    if ($packageContent -match '"vue"') {
        Write-Success "✅ vue found"
    }
    else {
        Write-Error "❌ vue missing"
    }
}

# Check for external dependencies bundling
Write-Status "🔍 Checking external dependencies bundling..."
if (Test-Path ".output/server/package.json") {
    Write-Host "External dependencies in server package.json:"
    $packageContent = Get-Content ".output/server/package.json" -Raw
    if ($packageContent -match '"dependencies"') {
        $depsMatch = [regex]::Match($packageContent, '"dependencies"\s*:\s*\{[^}]*\}')
        if ($depsMatch.Success) {
            Write-Host $depsMatch.Value
        }
    }
    else {
        Write-Host "No dependencies section found"
    }
}

# Check if external modules are properly bundled
Write-Status "🔍 Checking for external module issues..."
$mjsFiles = Get-ChildItem ".output/server" -Filter "*.mjs" -Recurse
$importFiles = @()
foreach ($file in $mjsFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match "import.*from.*['\""]") {
        $importFiles += $file.Name
    }
}

if ($importFiles.Count -gt 0) {
    Write-Host "Files with imports found:"
    $importFiles | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" }
}
else {
    Write-Warning "⚠️  No import statements found in .mjs files"
}

# Test 1: Syntax check
Write-Status "🧪 Test 1: Syntax check..."
try {
    $null = node --check ".output/server/index.mjs" 2>$null
    Write-Success "✅ Syntax check passed"
}
catch {
    Write-Error "❌ Syntax check failed"
    node --check ".output/server/index.mjs"
}

# Test 2: Module loading test with --trace-uncaught
Write-Status "🧪 Test 2: Module loading test with --trace-uncaught..."
try {
    $process = Start-Process -FilePath "node" -ArgumentList "--input-type=module", "--trace-warnings", "--trace-uncaught", ".output/server/index.mjs" -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 10
    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
        Write-Success "✅ Module loading test passed"
    }
    else {
        Write-Error "❌ Module loading test failed"
    }
}
catch {
    Write-Error "❌ Module loading test failed with exception"
    Write-Host $_.Exception.Message
}

# Test 3: Direct execution with full error capture and --trace-uncaught
Write-Status "🧪 Test 3: Direct execution with full error capture and --trace-uncaught..."
Write-Host "Running: node --trace-warnings --trace-uncaught .output/server/index.mjs"

# Create a temporary log file
$logFile = [System.IO.Path]::GetTempFileName()
Write-Host "Log file: $logFile"

# Run server with detailed output including --trace-uncaught
$process = Start-Process -FilePath "node" -ArgumentList "--trace-warnings", "--trace-uncaught", ".output/server/index.mjs" -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $logFile -WindowStyle Hidden

# Wait a moment for startup
Start-Sleep -Seconds 3

# Check if process is still running
if (-not $process.HasExited) {
    Write-Success "✅ Server process started (PID: $($process.Id))"
    
    # Wait for server to be ready
    Write-Status "⏳ Waiting for server to be ready..."
    $serverReady = $false
    for ($i = 1; $i -le 10; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Success "✅ Server is responding on port $Port"
                $serverReady = $true
                break
            }
        }
        catch {
            Write-Host "  Attempt $i/10..."
            Start-Sleep -Seconds 1
        }
    }
    
    # Test server response
    if ($serverReady) {
        Write-Success "✅ Server is working correctly!"
        
        # Test specific endpoints
        Write-Status "🧪 Testing endpoints..."
        
        # Test health endpoint
        try {
            $healthResponse = Invoke-WebRequest -Uri "http://localhost:$Port/api/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($healthResponse.StatusCode -eq 200) {
                Write-Success "✅ Health endpoint responding"
            }
            else {
                Write-Warning "⚠️  Health endpoint responding with $($healthResponse.StatusCode)"
            }
        }
        catch {
            Write-Warning "⚠️  Health endpoint not responding"
        }
        
        # Test root endpoint
        try {
            $rootResponse = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($rootResponse.StatusCode -eq 200) {
                Write-Success "✅ Root endpoint responding with 200"
            }
            else {
                Write-Warning "⚠️  Root endpoint responding with $($rootResponse.StatusCode)"
            }
        }
        catch {
            Write-Warning "⚠️  Root endpoint not responding"
        }
        
    }
    else {
        Write-Error "❌ Server is not responding"
        Write-Host "=== Server Output ==="
        if (Test-Path $logFile) {
            Get-Content $logFile
        }
        Write-Host "===================="
    }
    
}
else {
    Write-Error "❌ Server process died immediately"
    Write-Host "=== Server Output ==="
    if (Test-Path $logFile) {
        Get-Content $logFile
    }
    Write-Host "===================="
}

# Cleanup
Write-Status "🧹 Cleaning up..."
if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
}
if (Test-Path $logFile) {
    Remove-Item $logFile -Force
}

Write-Success "🎉 Comprehensive Nitro debug completed!" 