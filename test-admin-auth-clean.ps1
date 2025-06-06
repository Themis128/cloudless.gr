# Complete Admin Authentication Test Script
# Tests all admin auth functionality with detailed feedback

param(
    [string]$ServerUrl = "http://localhost:3000",
    [int]$MaxRetries = 10,
    [int]$RetryDelay = 2
)

# Global test state
$global:TestResults = @{
    ServerAvailability = $false
    AdminLoginValid = $false
    AdminLoginInvalid = $false
    AdminDashboard = $false
    ContactSubmissions = $false
    AdminLogout = $false
}
$global:TestErrors = @()
$global:AdminSession = $null

# Load credentials from .env file
$AdminEmail = "admin@cloudless.gr"
$AdminPassword = "cloudless2025"
$InvalidEmail = "wrong@email.com"
$InvalidPassword = "wrongpassword"

if (Test-Path ".env") {
    Write-Host "Loaded admin credentials from .env file" -ForegroundColor Cyan
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^ADMIN_EMAIL=(.+)$") { $AdminEmail = $matches[1] }
        if ($line -match "^ADMIN_PASSWORD=(.+)$") { $AdminPassword = $matches[1] }
    }
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "WARN" { "Yellow" }
        default { "White" }
    }
    Write-Host "$timestamp [$Level] $Message" -ForegroundColor $color
}

function Test-ServerAvailability {
    Write-Log "TEST: Server Availability"
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $ServerUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Log "Server is available (HTTP $($response.StatusCode))" "PASS"
                $global:TestResults.ServerAvailability = $true
                return
            }
        } catch {
            if ($i -lt $MaxRetries) {
                Write-Log "Attempt $i failed, retrying..." "WARN"
                Start-Sleep -Seconds $RetryDelay
            }
        }
    }
    Write-Log "Server unavailable after $MaxRetries attempts" "FAIL"
    $global:TestErrors += "Server unavailable"
}

function Test-AdminLoginValid {
    Write-Log "TEST: Admin Login with Valid Credentials"
    try {
        $loginData = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json -Compress
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $loginData -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        $json = $response.Content | ConvertFrom-Json
        
        if ($json.success) {
            # Extract cookies from response headers
            $setCookieHeader = $response.Headers["Set-Cookie"]
            if ($setCookieHeader) {
                $global:AdminSession = $setCookieHeader
                Write-Log "Login successful. Cookie extracted." "PASS"
            } else {
                $global:AdminSession = "admin-token=" + $json.token
                Write-Log "Login successful. Using token from JSON." "PASS"
            }
            $global:TestResults.AdminLoginValid = $true
        } else {
            throw "API returned success=false: $($json.message)"
        }
    } catch {
        Write-Log "Admin login failed: $($_.Exception.Message)" "FAIL"
        $global:TestErrors += "Valid login failed"
    }
}

function Test-AdminLoginInvalid {
    Write-Log "TEST: Admin Login with Invalid Credentials"
    try {
        $invalidData = @{ email = $InvalidEmail; password = $InvalidPassword } | ConvertTo-Json -Compress
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $invalidData -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue
        $json = $response.Content | ConvertFrom-Json
        if (-not $json.success) {
            $global:TestResults.AdminLoginInvalid = $true
            Write-Log "Invalid login correctly rejected" "PASS"
        } else {
            throw "API accepted invalid credentials"
        }
    } catch {
        Write-Log "Invalid login test completed" "PASS"
        $global:TestResults.AdminLoginInvalid = $true
    }
}

function Test-AdminDashboardAccess {
    Write-Log "TEST: Admin Dashboard Access"
    if (-not $global:AdminSession) {
        Write-Log "Skipped - No session available" "WARN"
        return
    }
    try {
        $headers = @{ Cookie = $global:AdminSession }
        $response = Invoke-WebRequest -Uri "$ServerUrl/admin/dashboard" -Headers $headers -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $global:TestResults.AdminDashboard = $true
            Write-Log "Dashboard accessible with session" "PASS"
        }
    } catch {
        Write-Log "Dashboard access failed: $($_.Exception.Message)" "FAIL"
        $global:TestErrors += "Dashboard access error"
    }
}

function Test-ContactSubmissions {
    Write-Log "TEST: Contact Submissions Access"
    if (-not $global:AdminSession) {
        Write-Log "Skipped - No session available" "WARN"
        return
    }
    try {
        $headers = @{ Cookie = $global:AdminSession }
        $response = Invoke-WebRequest -Uri "$ServerUrl/admin/contact-submissions" -Headers $headers -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $global:TestResults.ContactSubmissions = $true
            Write-Log "Contact submissions accessible" "PASS"
        }
    } catch {
        Write-Log "Contact submissions access failed" "FAIL"
        $global:TestErrors += "Contact submissions error"
    }
}

function Test-Logout {
    Write-Log "TEST: Admin Logout"
    if (-not $global:AdminSession) {
        Write-Log "Skipped - No session available" "WARN"
        return
    }
    try {
        $headers = @{ Cookie = $global:AdminSession }
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-logout" -Method POST -Headers $headers -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $global:TestResults.AdminLogout = $true
            Write-Log "Logout succeeded" "PASS"
        } else {
            throw "Logout failed with status $($response.StatusCode)"
        }
    } catch {
        Write-Log "Logout failed: $($_.Exception.Message)" "FAIL"
        $global:TestErrors += "Logout error"
    }
}

function Show-Summary {
    Write-Log "TEST SUMMARY:" "INFO"
    $passed = ($global:TestResults.Values | Where-Object { $_ -eq $true }).Count
    $total = $global:TestResults.Count
    $status = if ($passed -eq $total) { "PASS" } else { "WARN" }
    Write-Log "RESULT: $passed / $total tests passed" $status
    
    if ($global:TestErrors.Count -gt 0) {
        Write-Log "ERRORS:" "FAIL"
        $global:TestErrors | ForEach-Object { Write-Log "- $_" "FAIL" }
    }
    
    Write-Log "Individual Test Results:" "INFO"
    $global:TestResults.GetEnumerator() | ForEach-Object {
        $status = if ($_.Value) { "PASS" } else { "FAIL" }
        Write-Log "- $($_.Key): $($_.Value)" $status
    }
}

# Execute all tests
Write-Log "Starting Admin Authentication Test Suite" "INFO"
Write-Log "Testing against: $ServerUrl" "INFO"
Write-Log "Admin Email: $AdminEmail" "INFO"

Test-ServerAvailability
Test-AdminLoginValid
Test-AdminLoginInvalid
Test-AdminDashboardAccess
Test-ContactSubmissions
Test-Logout
Show-Summary

Write-Log "Test suite completed" "INFO"
