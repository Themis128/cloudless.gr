# Quick Fix Script for "Failed to fetch" Issues
# This script addresses common connectivity and configuration problems

Write-Host "🔧 Quick Fix for 'Failed to fetch' Issues" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# 1. Check environment file
Write-Host "📋 Checking environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "⚠️  .env file not found. Copying from .env.example" -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
        Write-Host "✅ Created .env file. Please update with your Supabase credentials." -ForegroundColor Green
    } else {
        Write-Host "❌ No .env or .env.example file found" -ForegroundColor Red
    }
} else {
    Write-Host "✅ .env file exists" -ForegroundColor Green
}

# 2. Check Node modules
Write-Host "📦 Checking node_modules..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    }
} else {
    Write-Host "✅ node_modules exists" -ForegroundColor Green
}

# 3. Clear Nuxt cache
Write-Host "🧹 Clearing Nuxt cache..." -ForegroundColor Yellow
if (Test-Path ".nuxt") {
    Remove-Item ".nuxt" -Recurse -Force
    Write-Host "✅ Cleared .nuxt cache" -ForegroundColor Green
}
if (Test-Path ".output") {
    Remove-Item ".output" -Recurse -Force
    Write-Host "✅ Cleared .output cache" -ForegroundColor Green
}

# 4. Check network connectivity
Write-Host "🌐 Testing network connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://httpbin.org/get" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Network connectivity OK" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Network test returned status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Network connectivity issues detected: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Check your internet connection and firewall settings" -ForegroundColor Cyan
}

# 5. Test Supabase connectivity (if .env exists)
if (Test-Path ".env") {
    Write-Host "🔗 Testing Supabase connectivity..." -ForegroundColor Yellow
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "SUPABASE_URL=(.+)") {
        $supabaseUrl = $matches[1].Trim()
        if ($supabaseUrl -and $supabaseUrl -ne "your_supabase_url_here") {
            try {
                $response = Invoke-WebRequest -Uri "$supabaseUrl/rest/v1/" -UseBasicParsing -TimeoutSec 10
                Write-Host "✅ Supabase endpoint reachable" -ForegroundColor Green
            } catch {
                Write-Host "❌ Cannot reach Supabase endpoint: $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "💡 Check your SUPABASE_URL in .env file" -ForegroundColor Cyan
            }
        } else {
            Write-Host "⚠️  SUPABASE_URL not configured in .env" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  SUPABASE_URL not found in .env" -ForegroundColor Yellow
    }
}

# 6. Restart development server
Write-Host "🚀 Recommendations:" -ForegroundColor Cyan
Write-Host "  1. Update your .env file with correct Supabase credentials" -ForegroundColor White
Write-Host "  2. Run 'npm run dev' to start the development server" -ForegroundColor White
Write-Host "  3. Visit http://localhost:3000/diagnostics to run system health check" -ForegroundColor White
Write-Host "  4. If issues persist, check the browser console for detailed errors" -ForegroundColor White

Write-Host ""
Write-Host "🔧 Quick fix complete!" -ForegroundColor Green
Write-Host "💡 If you're still experiencing issues, try:" -ForegroundColor Cyan
Write-Host "   - Restarting your computer" -ForegroundColor White
Write-Host "   - Checking Windows Defender/antivirus settings" -ForegroundColor White
Write-Host "   - Trying a different network connection" -ForegroundColor White
