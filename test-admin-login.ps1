# Test Admin Login - Cloudless.gr
# This script waits for the Nuxt server to be ready and then tests admin authentication

param(
    [string]$ServerUrl = "http://localhost:3000",
    [string]$AdminEmail = "admin@cloudless.gr",
    [string]$AdminPassword = "cloudless2025",
    [int]$MaxRetries = 15,
    [int]$RetryDelay = 2
)

Write-Host "🧪 Testing Admin Login for Cloudless.gr" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Step 1: Wait for Nuxt server to be ready
Write-Host "⏳ Waiting for Nuxt server to be ready..." -ForegroundColor Yellow
$serverReady = $false
$attempts = 0

for ($i = 0; $i -lt $MaxRetries; $i++) {
    $attempts++
    try {
        Write-Host "   Attempt $attempts/$MaxRetries..." -ForegroundColor Gray
        $ping = Invoke-WebRequest -Uri $ServerUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        
        if ($ping.StatusCode -eq 200) {
            Write-Host "✅ Nuxt server is up and responding!" -ForegroundColor Green
            $serverReady = $true
            break
        }
    } catch {
        if ($i -eq ($MaxRetries - 1)) {
            Write-Host "❌ Server check failed: $($_.Exception.Message)" -ForegroundColor Red
        }
        Start-Sleep -Seconds $RetryDelay
    }
}

if (-not $serverReady) {
    Write-Host "❌ Nuxt server not responding after $MaxRetries attempts." -ForegroundColor Red
    Write-Host "   Make sure the server is running with: npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 2: Test admin login endpoint
Write-Host "🔐 Testing admin login endpoint..." -ForegroundColor Yellow

$loginBody = @{
    email = $AdminEmail
    password = $AdminPassword
} | ConvertTo-Json

try {
    Write-Host "   Sending login request to: $ServerUrl/api/auth/admin-login" -ForegroundColor Gray
    Write-Host "   Email: $AdminEmail" -ForegroundColor Gray
    
    $response = Invoke-RestMethod -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    
    Write-Host "✅ Admin login successful!" -ForegroundColor Green
    Write-Host ""
    
    # Validate response structure
    Write-Host "📋 Response Analysis:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    
    $hasSuccess = $null -ne $response.success
    $hasUser = $null -ne $response.user
    $hasToken = $null -ne $response.token -and $response.token.Length -gt 0
    $hasExpiresAt = $null -ne $response.expiresAt
    $hasMessage = $null -ne $response.message
    
    Write-Host "   ✓ success: $($response.success)" -ForegroundColor $(if ($hasSuccess) { "Green" } else { "Red" })
    Write-Host "   ✓ message: $($response.message)" -ForegroundColor $(if ($hasMessage) { "Green" } else { "Red" })
    Write-Host "   ✓ user.id: $($response.user.id)" -ForegroundColor $(if ($hasUser) { "Green" } else { "Red" })
    Write-Host "   ✓ user.email: $($response.user.email)" -ForegroundColor $(if ($hasUser) { "Green" } else { "Red" })
    Write-Host "   ✓ user.role: $($response.user.role)" -ForegroundColor $(if ($hasUser) { "Green" } else { "Red" })
    Write-Host "   ✓ token: $($hasToken ? "Present (" + $response.token.Length + " chars)" : "Missing")" -ForegroundColor $(if ($hasToken) { "Green" } else { "Red" })
    Write-Host "   ✓ expiresAt: $($hasExpiresAt ? $response.expiresAt : "Missing")" -ForegroundColor $(if ($hasExpiresAt) { "Green" } else { "Red" })
    
    if ($hasExpiresAt) {
        $expiryDate = [DateTimeOffset]::FromUnixTimeSeconds($response.expiresAt).DateTime
        Write-Host "   ✓ expires: $($expiryDate.ToString("yyyy-MM-dd HH:mm:ss")) UTC" -ForegroundColor Green
    }
    
    Write-Host ""
    
    # Full response for debugging
    Write-Host "📄 Full Response:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor White
    
    Write-Host ""
    
    # Validation summary
    $allFieldsPresent = $hasSuccess -and $hasUser -and $hasToken -and $hasExpiresAt -and $hasMessage
    if ($allFieldsPresent) {
        Write-Host "🎉 All required fields are present! Frontend integration should work." -ForegroundColor Green
    } else {
        Write-Host "⚠️  Some required fields are missing. Check the API implementation." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Admin login failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        
        try {
            $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "   Server Error: $($errorResponse.message)" -ForegroundColor Red
        } catch {
            Write-Host "   Raw Error: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   • Check if ADMIN_EMAIL and ADMIN_PASSWORD environment variables are set" -ForegroundColor Gray
    Write-Host "   • Verify the server is running on port 3000" -ForegroundColor Gray
    Write-Host "   • Check server logs for detailed error information" -ForegroundColor Gray
    
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎯 Admin Login Test Complete!" -ForegroundColor Green
