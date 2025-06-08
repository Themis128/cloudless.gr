# Quick Admin Auth Test - Simple version for rapid testing
param(
    [string]$ServerUrl = "http://localhost:3000",
    [string]$AdminEmail = "admin@cloudless.gr", 
    [string]$AdminPassword = "cloudless2025"
)

Write-Host "🔐 Quick Admin Auth Test" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

# Test 1: Server Check
Write-Host "`n1. Checking server..." -NoNewline
try {
    $ping = Invoke-WebRequest -Uri $ServerUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host " ✅ Server running" -ForegroundColor Green
} catch {
    Write-Host " ❌ Server not available" -ForegroundColor Red
    Write-Host "Please start with: npm run dev" -ForegroundColor Yellow
    exit 1
}

# Test 2: Admin Login
Write-Host "2. Testing admin login..." -NoNewline
try {
    $loginData = @{
        email = $AdminEmail
        password = $AdminPassword
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $loginData -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    $result = $response.Content | ConvertFrom-Json
      if ($result.success) {
        Write-Host " ✓ Login successful" -ForegroundColor Green
        $sessionCookie = $response.Headers['Set-Cookie'] -join "; "
    } else {
        Write-Host " X Login failed: $($result.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host " X Login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 3: Admin Dashboard Access
Write-Host "3. Testing dashboard access..." -NoNewline
try {
    $headers = @{ 'Cookie' = $sessionCookie }
    $dashResponse = Invoke-WebRequest -Uri "$ServerUrl/admin/dashboard" -Headers $headers -UseBasicParsing -ErrorAction Stop
    Write-Host " ✓ Dashboard accessible" -ForegroundColor Green
} catch {
    Write-Host " X Dashboard access failed" -ForegroundColor Red
}

# Test 4: Session Check
Write-Host "4. Testing session..." -NoNewline
try {
    $headers = @{ 'Cookie' = $sessionCookie }
    $sessionResponse = Invoke-WebRequest -Uri "$ServerUrl/api/auth/session" -Headers $headers -UseBasicParsing -ErrorAction Stop
    $sessionData = $sessionResponse.Content | ConvertFrom-Json
      if ($sessionData.authenticated -and $sessionData.role -eq "admin") {
        Write-Host " ✓ Session valid" -ForegroundColor Green
        Write-Host "   User: $($sessionData.user.email)" -ForegroundColor Gray
    } else {
        Write-Host " X Session invalid" -ForegroundColor Red
    }
} catch {
    Write-Host " X Session check failed" -ForegroundColor Red
}

Write-Host "`nQuick test completed!" -ForegroundColor Green
Write-Host "Run the complete test with: .\test-admin-auth-complete.ps1" -ForegroundColor Cyan
