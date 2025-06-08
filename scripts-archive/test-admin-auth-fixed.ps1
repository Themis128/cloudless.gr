# Test Admin Authentication - Cloudless.gr
# Fixed version without Unicode characters

param(
    [string]$ServerUrl = "http://localhost:3000",
    [string]$AdminEmail = "admin@cloudless.gr", 
    [string]$AdminPassword = "cloudless2025",
    [string]$InvalidEmail = "hacker@evil.com",
    [string]$InvalidPassword = "wrongpassword",
    [int]$MaxRetries = 30
)

# Global variables
$global:TestResults = @{
    ServerAvailable = $false
    AdminLoginValid = $false
    AdminLoginInvalid = $false
    AdminDashboard = $false
    AdminLogout = $false
}
$global:TestErrors = @()
$global:AdminSession = ""

# Load environment variables from .env file
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            if ($name -eq "ADMIN_EMAIL") { $AdminEmail = $value }
            if ($name -eq "ADMIN_PASSWORD") { $AdminPassword = $value }
        }
    }
    Write-Host "Info: Loaded admin credentials from .env file" -ForegroundColor Cyan
}

function Write-Log {
    param($Message, $Type = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Type) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "WARN" { "Yellow" }
        default { "White" }
    }
    Write-Host "$timestamp [$Type] $Message" -ForegroundColor $color
}

function Test-ServerAvailability {
    Write-Log "TEST: Server Availability"
    for ($i = 0; $i -lt $MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $ServerUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $global:TestResults.ServerAvailable = $true
                Write-Log "Server is available (HTTP 200)" "PASS"
                return
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    Write-Log "Server unavailable after $MaxRetries attempts" "FAIL"
    $global:TestErrors += "Server unavailable"
}

function Test-AdminLoginValid {
    Write-Log "TEST: Admin Login with Valid Credentials"
    try {
        $loginData = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $loginData -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        
        # Extract session cookie
        $sessionCookie = $response.Headers['Set-Cookie'] | Where-Object { $_ -match 'admin-token=' }
        if ($sessionCookie) {
            $global:AdminSession = $sessionCookie.Split(';')[0]
        }
        
        $json = $response.Content | ConvertFrom-Json
        if ($json.success) {
            Write-Log "Login successful. Session available." "PASS"
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
        $invalidData = @{ email = $InvalidEmail; password = $InvalidPassword } | ConvertTo-Json
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $invalidData -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue
        $json = $response.Content | ConvertFrom-Json
        if (-not $json.success) {
            $global:TestResults.AdminLoginInvalid = $true
            Write-Log "Invalid login correctly rejected" "PASS"
        } else {
            throw "API accepted invalid credentials"
        }
    } catch {
        Write-Log "Invalid login test failed" "FAIL"
        $global:TestErrors += "Invalid login test error"
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
        Write-Log "Dashboard access failed" "FAIL"
        $global:TestErrors += "Dashboard access error"
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
    Write-Log "TEST SUMMARY:"
    $passed = ($global:TestResults.Values | Where-Object { $_ -eq $true }).Count
    $total = $global:TestResults.Count
    Write-Log "RESULT: $passed / $total tests passed" "$(if ($passed -eq $total) { "PASS" } else { "WARN" })"
    if ($global:TestErrors.Count -gt 0) {
        Write-Log "ERRORS:"
        $global:TestErrors | ForEach-Object { Write-Log "- $_" "FAIL" }
    }
}

# Execute all tests
Test-ServerAvailability
Test-AdminLoginValid
Test-AdminLoginInvalid
Test-AdminDashboardAccess
Test-Logout
Show-Summary
