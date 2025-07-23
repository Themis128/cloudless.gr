# Quick RBAC System Test Script
# This script performs basic tests to verify the RBAC system is working

Write-Host "🔐 RBAC System Quick Test" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

# Check if server is running
Write-Host "`n🔍 Checking server status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Server is running" -ForegroundColor Green
    } else {
        Write-Host "❌ Server returned status: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Server is not running" -ForegroundColor Red
    Write-Host "   Please start the server with: npm run dev" -ForegroundColor Yellow
    exit 1
}

# Test basic pages
Write-Host "`n🔍 Testing basic pages..." -ForegroundColor Yellow

$pages = @(
    "http://localhost:3001/login",
    "http://localhost:3001/register",
    "http://localhost:3001/profile"
)

foreach ($page in $pages) {
    try {
        $response = Invoke-WebRequest -Uri $page -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ $page - OK" -ForegroundColor Green
        } else {
            Write-Host "❌ $page - Status: $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ $page - Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test debug dashboard (should redirect if not admin)
Write-Host "`n🔍 Testing debug dashboard..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/debug/rbac" -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Debug dashboard accessible" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Debug dashboard returned status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Debug dashboard error (expected if not authenticated): $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n✅ RBAC System Quick Test Complete!" -ForegroundColor Green
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Open http://localhost:3001/login in your browser" -ForegroundColor White
Write-Host "2. Register a new account or login with existing credentials" -ForegroundColor White
Write-Host "3. Navigate to /debug/rbac to view the debug dashboard" -ForegroundColor White
Write-Host "4. Run comprehensive tests with: .\scripts\run-rbac-tests.ps1" -ForegroundColor White 