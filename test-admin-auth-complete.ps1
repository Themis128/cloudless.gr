param(
    [string]$ServerUrl = "http://localhost:3000",
    [int]$MaxRetries = 20,
    [int]$RetryDelay = 3
)

# Load .env file if present
$envPath = ".\.env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^\s*([^#][\w_]+)\s*=\s*(.+)\s*$") {
            $key = $matches[1]
            $value = $matches[2] -replace "^['""]|['""]$"
            [System.Environment]::SetEnvironmentVariable($key, $value)
        }
    }
    $AdminEmail = $env:AdminEmail
    $AdminPassword = $env:AdminPassword
    Write-Host "INFO: Loaded admin credentials from .env file"
} else {
    Write-Warning ".env file not found. Aborting test."
    exit 1
}

$InvalidEmail = "hacker@evil.com"
$InvalidPassword = "wrongpassword"

# Global state
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

function Write-Log {
    param (
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "$timestamp [$Level] $Message"
    Write-Host "$entry"
    Add-Content -Path "admin-auth-log.txt" -Value $entry
}

function Test-ServerAvailability {
    Write-Log "TEST: Server Availability"
    for ($i = 0; $i -lt $MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $ServerUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop            if ($response.StatusCode -eq 200) {
                Write-Log "PASS: Server is available (HTTP $($response.StatusCode))" "PASS"
                $global:TestResults.ServerAvailability = $true
                return
            }
        } catch {
            Start-Sleep -Seconds $RetryDelay
        }
    }
    Write-Log "FAIL: Server unavailable after $MaxRetries attempts" "FAIL"
    $global:TestErrors += "Server unavailable"
}

function Test-AdminLoginValid {
    Write-Log "🔸 TEST: Admin Login with Valid Credentials"
    try {
        $loginData = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json -Compress
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $loginData -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        $json = $response.Content | ConvertFrom-Json
        
        Write-Log "Response status: $($response.StatusCode)" "INFO"
        Write-Log "Response content: $($response.Content)" "INFO"
        
        if ($json.success) {
            # Extract cookies from response headers
            $setCookieHeader = $response.Headers["Set-Cookie"]
            if ($setCookieHeader) {
                $global:AdminSession = $setCookieHeader
                Write-Log "✅ Login successful. Cookie extracted." "PASS"
            } else {
                $global:AdminSession = "admin-token=" + $json.token
                Write-Log "✅ Login successful. Using token from JSON." "PASS"
            }
            $global:TestResults.AdminLoginValid = $true
        } else {
            throw "API returned success=false: $($json.message)"
        }
    } catch {
        Write-Log "❌ Admin login failed: $($_.Exception.Message)" "FAIL"
        $global:TestErrors += "Valid login failed"
    }
}

function Test-AdminLoginInvalid {
    Write-Log "🔸 TEST: Admin Login with Invalid Credentials"
    try {
        $invalidData = @{ email = $InvalidEmail; password = $InvalidPassword } | ConvertTo-Json -Compress
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $invalidData -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue
        $json = $response.Content | ConvertFrom-Json
        if (-not $json.success) {
            $global:TestResults.AdminLoginInvalid = $true
            Write-Log "✅ Invalid login correctly rejected" "PASS"
        } else {
            throw "API accepted invalid credentials"
        }
    } catch {
        Write-Log "❌ Invalid login test failed" "FAIL"
        $global:TestErrors += "Invalid login test error"
    }
}

function Test-AdminDashboardAccess {
    Write-Log "🔸 TEST: Admin Dashboard Access"
    if (-not $global:AdminSession) {
        Write-Log "⚠️  Skipped - No session available" "WARN"
        return
    }
    try {
        $headers = @{ Cookie = $global:AdminSession }
        $response = Invoke-WebRequest -Uri "$ServerUrl/admin/dashboard" -Headers $headers -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $global:TestResults.AdminDashboard = $true
            Write-Log "✅ Dashboard accessible with session" "PASS"
        }
    } catch {
        Write-Log "❌ Dashboard access failed" "FAIL"
        $global:TestErrors += "Dashboard access error"
    }
}

function Test-Logout {
    Write-Log "🔸 TEST: Admin Logout"
    if (-not $global:AdminSession) {
        Write-Log "⚠️  Skipped - No session available" "WARN"
        return
    }
    try {
        $headers = @{ Cookie = $global:AdminSession }
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-logout" -Method POST -Headers $headers -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $global:TestResults.AdminLogout = $true
            Write-Log "✅ Logout succeeded" "PASS"
        } else {
            throw "Logout failed with status $($response.StatusCode)"
        }
    } catch {
        Write-Log "❌ Logout failed: $($_.Exception.Message)" "FAIL"
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

# 🚀 Execute all tests
Test-ServerAvailability
Test-AdminLoginValid
Test-AdminLoginInvalid
Test-AdminDashboardAccess
Test-Logout
Show-Summary
