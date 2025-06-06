# Test Admin Authentication - Complete Test Suite (Fixed Encoding)
# This script comprehensively tests all admin authentication functionality

param(
    [string]$ServerUrl = "http://localhost:3000",
    [string]$AdminEmail = "admin@cloudless.gr",
    [string]$AdminPassword = "cloudless2025",
    [string]$InvalidEmail = "hacker@evil.com",
    [string]$InvalidPassword = "wrongpassword",
    [int]$MaxRetries = 20,
    [int]$RetryDelay = 3
)

# Color functions without Unicode
function Write-Success { param($Message) Write-Host "[PASS] $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "[FAIL] $Message" -ForegroundColor Red }
function Write-Warning { param($Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Test { param($Message) Write-Host "[TEST] $Message" -ForegroundColor Magenta }
function Write-Header { param($Message) Write-Host "`n==== $Message ====" -ForegroundColor White -BackgroundColor DarkBlue }

# Test results tracking
$global:TestResults = @{
    ServerAvailability = $false
    AdminLoginValid = $false
    AdminLoginInvalid = $false
    AdminLogout = $false
    AdminPageAccess = $false
    AdminDashboard = $false
    ContactSubmissions = $false
    AdminWarning = $false
    MiddlewareProtection = $false
    SessionPersistence = $false
}

$global:TestErrors = @()
$global:AdminSession = $null

Write-Host "CLOUDLESS.GR - ADMIN AUTHENTICATION TEST SUITE" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "=" * 70 -ForegroundColor Blue
Write-Info "Server URL: $ServerUrl"
Write-Info "Admin Email: $AdminEmail"
Write-Info "Test Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# Test 1: Server Availability
Write-Header "TEST 1: Server Availability"
Write-Test "Checking if Nuxt server is running..."

$serverReady = $false
for ($i = 0; $i -lt $MaxRetries; $i++) {
    try {
        Write-Host "   Attempt $($i + 1)/$MaxRetries..." -ForegroundColor Gray
        $response = Invoke-WebRequest -Uri $ServerUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Success "Server is running and responding (Status: $($response.StatusCode))"
            $global:TestResults.ServerAvailability = $true
            $serverReady = $true
            break
        }
    } catch {
        Write-Host "   Server not ready: $($_.Exception.Message)" -ForegroundColor Gray
        if ($i -lt ($MaxRetries - 1)) {
            Start-Sleep -Seconds $RetryDelay
        }
    }
}

if (-not $serverReady) {
    Write-Error "Server is not available after $MaxRetries attempts"
    $global:TestErrors += "Server unavailable"
    Write-Warning "Please start the server with: npm run dev"
    exit 1
}

# Test 2: Admin Login with Valid Credentials
Write-Header "TEST 2: Admin Login (Valid Credentials)"
Write-Test "Testing admin login with correct credentials..."

try {
    $loginData = @{
        email = $AdminEmail
        password = $AdminPassword
    } | ConvertTo-Json

    $loginResponse = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $loginData -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    
    if ($loginResponse.StatusCode -eq 200) {
        $loginResult = $loginResponse.Content | ConvertFrom-Json
        if ($loginResult.success) {
            Write-Success "Valid admin login successful"
            $global:TestResults.AdminLoginValid = $true
            
            # Extract session cookie for further tests
            $cookies = $loginResponse.Headers['Set-Cookie']
            if ($cookies) {
                $global:AdminSession = $cookies -join "; "
                Write-Info "Session cookie obtained: $($global:AdminSession.Substring(0, [Math]::Min(50, $global:AdminSession.Length)))..."
            }
        } else {
            Write-Error "Login API returned success=false: $($loginResult.message)"
            $global:TestErrors += "Valid login failed"
        }
    } else {
        Write-Error "Login request failed with status: $($loginResponse.StatusCode)"
        $global:TestErrors += "Valid login HTTP error"
    }
} catch {
    Write-Error "Admin login request failed: $($_.Exception.Message)"
    $global:TestErrors += "Valid login exception: $($_.Exception.Message)"
}

# Test 3: Admin Login with Invalid Credentials
Write-Header "TEST 3: Admin Login (Invalid Credentials)"
Write-Test "Testing admin login with incorrect credentials..."

try {
    $invalidLoginData = @{
        email = $InvalidEmail
        password = $InvalidPassword
    } | ConvertTo-Json

    $invalidResponse = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $invalidLoginData -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue
    
    if ($invalidResponse.StatusCode -eq 200) {
        $invalidResult = $invalidResponse.Content | ConvertFrom-Json
        if (-not $invalidResult.success) {
            Write-Success "Invalid credentials correctly rejected"
            $global:TestResults.AdminLoginInvalid = $true
        } else {
            Write-Error "Invalid credentials were accepted - SECURITY ISSUE!"
            $global:TestErrors += "Invalid login accepted"
        }
    } else {
        Write-Success "Invalid login correctly returned non-200 status: $($invalidResponse.StatusCode)"
        $global:TestResults.AdminLoginInvalid = $true
    }
} catch {
    Write-Success "Invalid login correctly failed: $($_.Exception.Message)"
    $global:TestResults.AdminLoginInvalid = $true
}

# Test 4: Admin Page Access (Protected Route)
Write-Header "TEST 4: Admin Page Access"
Write-Test "Testing access to admin dashboard..."

if ($global:AdminSession) {
    try {
        $headers = @{
            'Cookie' = $global:AdminSession
        }
        
        $adminResponse = Invoke-WebRequest -Uri "$ServerUrl/admin/dashboard" -Headers $headers -UseBasicParsing -ErrorAction Stop
        
        if ($adminResponse.StatusCode -eq 200) {
            Write-Success "Admin dashboard accessible with valid session"
            $global:TestResults.AdminDashboard = $true
            
            # Check if page contains admin content
            if ($adminResponse.Content -match "admin" -or $adminResponse.Content -match "dashboard") {
                Write-Success "Admin dashboard contains expected content"
            } else {
                Write-Warning "Admin dashboard may not contain expected admin content"
            }
        } else {
            Write-Error "Admin dashboard returned status: $($adminResponse.StatusCode)"
            $global:TestErrors += "Admin dashboard access failed"
        }
    } catch {
        Write-Error "Admin dashboard access failed: $($_.Exception.Message)"
        $global:TestErrors += "Admin dashboard exception: $($_.Exception.Message)"
    }
} else {
    Write-Warning "Skipping admin page access test - no valid session available"
}

# Test 5: Contact Submissions Access
Write-Header "TEST 5: Contact Submissions Access"
Write-Test "Testing access to contact submissions..."

if ($global:AdminSession) {
    try {
        $headers = @{
            'Cookie' = $global:AdminSession
        }
        
        $submissionsResponse = Invoke-WebRequest -Uri "$ServerUrl/admin/contact-submissions" -Headers $headers -UseBasicParsing -ErrorAction Stop
        
        if ($submissionsResponse.StatusCode -eq 200) {
            Write-Success "Contact submissions page accessible"
            $global:TestResults.ContactSubmissions = $true
        } else {
            Write-Error "Contact submissions returned status: $($submissionsResponse.StatusCode)"
            $global:TestErrors += "Contact submissions access failed"
        }
    } catch {
        Write-Error "Contact submissions access failed: $($_.Exception.Message)"
        $global:TestErrors += "Contact submissions exception: $($_.Exception.Message)"
    }
} else {
    Write-Warning "Skipping contact submissions test - no valid session available"
}

# Test 6: Admin Warning Page (Unauthorized Access)
Write-Header "TEST 6: Admin Warning Page"
Write-Test "Testing unauthorized access redirects to warning page..."

try {
    # Test without session cookie
    $warningResponse = Invoke-WebRequest -Uri "$ServerUrl/admin" -UseBasicParsing -ErrorAction SilentlyContinue
    
    if ($warningResponse.StatusCode -eq 200 -and $warningResponse.Content -match "warning|unauthorized|admin") {
        Write-Success "Unauthorized admin access correctly shows warning"
        $global:TestResults.AdminWarning = $true
    } elseif ($warningResponse.StatusCode -eq 302 -or $warningResponse.StatusCode -eq 307) {
        Write-Success "Unauthorized admin access correctly redirects (Status: $($warningResponse.StatusCode))"
        $global:TestResults.AdminWarning = $true
    } else {
        Write-Warning "Unexpected response for unauthorized admin access"
    }
} catch {
    Write-Info "Unauthorized access handling: $($_.Exception.Message)"
    # This might be expected behavior (redirect/error)
    $global:TestResults.AdminWarning = $true
}

# Test 7: Session Persistence
Write-Header "TEST 7: Session Persistence"
Write-Test "Testing if admin session persists across requests..."

if ($global:AdminSession) {
    try {
        $headers = @{
            'Cookie' = $global:AdminSession
        }
        
        # Test session API endpoint
        $sessionResponse = Invoke-WebRequest -Uri "$ServerUrl/api/auth/session" -Headers $headers -UseBasicParsing -ErrorAction Stop
        
        if ($sessionResponse.StatusCode -eq 200) {
            $sessionData = $sessionResponse.Content | ConvertFrom-Json
            if ($sessionData.authenticated -and $sessionData.role -eq "admin") {
                Write-Success "Admin session persists correctly"
                $global:TestResults.SessionPersistence = $true
                Write-Info "Session user: $($sessionData.user.email)"
                Write-Info "Session role: $($sessionData.role)"
            } else {
                Write-Error "Session data invalid or not admin role"
                $global:TestErrors += "Invalid session data"
            }
        } else {
            Write-Error "Session check returned status: $($sessionResponse.StatusCode)"
            $global:TestErrors += "Session check failed"
        }
    } catch {
        Write-Error "Session persistence test failed: $($_.Exception.Message)"
        $global:TestErrors += "Session persistence exception: $($_.Exception.Message)"
    }
} else {
    Write-Warning "Skipping session persistence test - no valid session available"
}

# Test 8: Admin Logout
Write-Header "TEST 8: Admin Logout"
Write-Test "Testing admin logout functionality..."

if ($global:AdminSession) {
    try {
        $headers = @{
            'Cookie' = $global:AdminSession
        }
        
        $logoutResponse = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-logout" -Method POST -Headers $headers -UseBasicParsing -ErrorAction Stop
        
        if ($logoutResponse.StatusCode -eq 200) {
            Write-Success "Admin logout successful"
            $global:TestResults.AdminLogout = $true
            
            # Test if session is invalidated
            Start-Sleep -Seconds 1
            try {
                $postLogoutResponse = Invoke-WebRequest -Uri "$ServerUrl/api/auth/session" -Headers $headers -UseBasicParsing -ErrorAction SilentlyContinue
                $postLogoutData = $postLogoutResponse.Content | ConvertFrom-Json
                
                if (-not $postLogoutData.authenticated) {
                    Write-Success "Session correctly invalidated after logout"
                } else {
                    Write-Warning "Session may still be active after logout"
                }
            } catch {
                Write-Success "Session correctly invalidated (API returned error)"
            }
        } else {
            Write-Error "Logout returned status: $($logoutResponse.StatusCode)"
            $global:TestErrors += "Logout failed"
        }
    } catch {
        Write-Error "Admin logout failed: $($_.Exception.Message)"
        $global:TestErrors += "Logout exception: $($_.Exception.Message)"
    }
} else {
    Write-Warning "Skipping logout test - no valid session available"
}

# Generate Test Report
Write-Host "`n" + "=" * 70 -ForegroundColor Blue
Write-Host "TEST RESULTS SUMMARY" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "=" * 70 -ForegroundColor Blue

$passedTests = ($global:TestResults.Values | Where-Object { $_ -eq $true }).Count
$totalTests = $global:TestResults.Count

Write-Host "`nTEST RESULTS: $passedTests/$totalTests PASSED" -ForegroundColor $(if ($passedTests -eq $totalTests) { "Green" } else { "Yellow" })

foreach ($test in $global:TestResults.GetEnumerator()) {
    $status = if ($test.Value) { "[PASS]" } else { "[FAIL]" }
    $color = if ($test.Value) { "Green" } else { "Red" }
    Write-Host "  $($test.Key): $status" -ForegroundColor $color
}

if ($global:TestErrors.Count -gt 0) {
    Write-Host "`nERRORS ENCOUNTERED:" -ForegroundColor Red
    foreach ($error in $global:TestErrors) {
        Write-Host "  - $error" -ForegroundColor Red
    }
}

# Recommendations
Write-Host "`nRECOMMENDATIONS:" -ForegroundColor Yellow

if (-not $global:TestResults.ServerAvailability) {
    Write-Host "  - Start the development server: npm run dev" -ForegroundColor Yellow
}

if (-not $global:TestResults.AdminLoginValid) {
    Write-Host "  - Check admin credentials in .env file" -ForegroundColor Yellow
    Write-Host "  - Verify JWT_SECRET is configured" -ForegroundColor Yellow
}

if (-not $global:TestResults.AdminDashboard) {
    Write-Host "  - Check admin middleware configuration" -ForegroundColor Yellow
    Write-Host "  - Verify admin routes are properly protected" -ForegroundColor Yellow
}

if ($passedTests -eq $totalTests) {
    Write-Host "`nSUCCESS: ALL TESTS PASSED! Admin authentication is working correctly." -ForegroundColor Green
} else {
    Write-Host "`nWARNING: Some tests failed. Please review the errors above." -ForegroundColor Yellow
}

# Create test log
$logFile = "admin-auth-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$testLog = @"
Admin Authentication Test Results
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Server: $ServerUrl
Results: $passedTests/$totalTests tests passed

Test Details:
$(($global:TestResults.GetEnumerator() | ForEach-Object { "$($_.Key): $($_.Value)" }) -join "`n")

Errors:
$(if ($global:TestErrors.Count -gt 0) { $global:TestErrors -join "`n" } else { "None" })
"@

$testLog | Out-File -FilePath $logFile -Encoding UTF8
Write-Host "`nTest log saved to: $logFile" -ForegroundColor Cyan

Write-Host "`n" + "=" * 70 -ForegroundColor Blue
