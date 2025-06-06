# Complete Authentication Test Suite
# Comprehensive test suite for CI/CD integration and complete validation

param(
    [string]$ServerUrl = "http://localhost:3000",
    [string]$Environment = "development",
    [switch]$SkipServerCheck,
    [switch]$GenerateReport,
    [string]$ReportPath = "auth-test-report.json",
    [int]$MaxRetries = 10,
    [int]$RetryDelay = 2
)

# Global state
$global:AllTestResults = @{
    ServerAvailability = @{}
    AdminAuthentication = @{}
    MiddlewareProtection = @{}
    JWTValidation = @{}
}
$global:AllTestErrors = @()
$global:TestStartTime = Get-Date
$global:AdminSession = $null
$global:AdminToken = $null

# Load environment variables
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^ADMIN_EMAIL=(.+)$") { $global:AdminEmail = $matches[1] }
        if ($line -match "^ADMIN_PASSWORD=(.+)$") { $global:AdminPassword = $matches[1] }
    }
} else {
    $global:AdminEmail = "admin@cloudless.gr"
    $global:AdminPassword = "cloudless2025"
}

$global:InvalidEmail = "hacker@evil.com"
$global:InvalidPassword = "wrongpassword"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO", [string]$Category = "GENERAL")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "WARN" { "Yellow" }
        "INFO" { "Cyan" }
        default { "White" }
    }
    $entry = "$timestamp [$Level][$Category] $Message"
    Write-Host $entry -ForegroundColor $color

    # Log to file
    Add-Content -Path "complete-auth-test.log" -Value $entry -ErrorAction SilentlyContinue
}

function ConvertFrom-Base64Url {
    param([string]$base64Url)
    $padding = 4 - ($base64Url.Length % 4)
    if ($padding -ne 4) { $base64Url += "=" * $padding }
    $base64 = $base64Url.Replace('-', '+').Replace('_', '/')
    try {
        $bytes = [Convert]::FromBase64String($base64)
        return [System.Text.Encoding]::UTF8.GetString($bytes)
    } catch {
        throw "Failed to decode base64: $($_.Exception.Message)"
    }
}

# === SERVER AVAILABILITY TESTS ===
function Test-ServerAvailability {
    Write-Log "Starting Server Availability Tests" "INFO" "SERVER"

    if ($SkipServerCheck) {
        Write-Log "Skipping server availability check" "WARN" "SERVER"
        $global:AllTestResults.ServerAvailability.Available = $true
        return
    }

    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $ServerUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 307) {
                $global:AllTestResults.ServerAvailability.Available = $true
                Write-Log "Server is available (HTTP $($response.StatusCode))" "PASS" "SERVER"

                # Test specific endpoints
                Test-HealthEndpoints
                return
            }
        } catch {
            if ($i -lt $MaxRetries) {
                Write-Log "Attempt $i failed, retrying in $RetryDelay seconds..." "WARN" "SERVER"
                Start-Sleep -Seconds $RetryDelay
            }
        }
    }

    $global:AllTestResults.ServerAvailability.Available = $false
    $global:AllTestErrors += "Server unavailable after $MaxRetries attempts"
    Write-Log "Server unavailable after $MaxRetries attempts" "FAIL" "SERVER"
}

function Test-HealthEndpoints {
    $endpoints = @{
        "/auth/login" = "LoginPageAccessible"
        "/admin-warning" = "AdminWarningAccessible"
    }

    foreach ($endpoint in $endpoints.Keys) {
        try {
            $response = Invoke-WebRequest -Uri "$ServerUrl$endpoint" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
            $global:AllTestResults.ServerAvailability[$endpoints[$endpoint]] = ($response.StatusCode -eq 200)
            $status = if ($response.StatusCode -eq 200) { "PASS" } else { "WARN" }
            Write-Log "$endpoint accessible (Status: $($response.StatusCode))" $status "SERVER"
        } catch {
            $global:AllTestResults.ServerAvailability[$endpoints[$endpoint]] = $false
            Write-Log "$endpoint not accessible: $($_.Exception.Message)" "FAIL" "SERVER"
        }
    }
}

# === ADMIN AUTHENTICATION TESTS ===
function Test-AdminAuthentication {
    Write-Log "Starting Admin Authentication Tests" "INFO" "AUTH"

    Test-ValidAdminLogin
    Test-InvalidAdminLogin
    Test-AdminDashboardAccess
    Test-AdminLogout
}

function Test-ValidAdminLogin {
    try {
        $loginData = @{ email = $global:AdminEmail; password = $global:AdminPassword } | ConvertTo-Json -Compress
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $loginData -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        $json = $response.Content | ConvertFrom-Json

        if ($json.success) {
            $global:AllTestResults.AdminAuthentication.ValidLogin = $true
            $global:AdminToken = $json.token

            # Extract session cookie
            $setCookieHeader = $response.Headers["Set-Cookie"]
            if ($setCookieHeader) {
                $global:AdminSession = $setCookieHeader
            } else {
                $global:AdminSession = "admin-token=" + $json.token
            }

            Write-Log "Valid admin login successful" "PASS" "AUTH"
        } else {
            throw "API returned success=false: $($json.message)"
        }
    } catch {
        $global:AllTestResults.AdminAuthentication.ValidLogin = $false
        $global:AllTestErrors += "Valid admin login failed"
        Write-Log "Valid admin login failed: $($_.Exception.Message)" "FAIL" "AUTH"
    }
}

function Test-InvalidAdminLogin {
    try {
        $invalidData = @{ email = $global:InvalidEmail; password = $global:InvalidPassword } | ConvertTo-Json -Compress
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $invalidData -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue
        $json = $response.Content | ConvertFrom-Json

        $global:AllTestResults.AdminAuthentication.InvalidLoginRejected = (-not $json.success)
        $status = if (-not $json.success) { "PASS" } else { "FAIL" }
        Write-Log "Invalid login correctly rejected: $(-not $json.success)" $status "AUTH"
    } catch {
        $global:AllTestResults.AdminAuthentication.InvalidLoginRejected = $true
        Write-Log "Invalid login properly rejected (exception expected)" "PASS" "AUTH"
    }
}

function Test-AdminDashboardAccess {
    if (-not $global:AdminSession) {
        $global:AllTestResults.AdminAuthentication.DashboardAccess = $false
        Write-Log "Skipped dashboard test - no session available" "WARN" "AUTH"
        return
    }

    try {
        $headers = @{ Cookie = $global:AdminSession }
        $response = Invoke-WebRequest -Uri "$ServerUrl/admin/dashboard" -Headers $headers -UseBasicParsing -ErrorAction Stop

        $global:AllTestResults.AdminAuthentication.DashboardAccess = ($response.StatusCode -eq 200)
        $status = if ($response.StatusCode -eq 200) { "PASS" } else { "FAIL" }
        Write-Log "Admin dashboard access: $($response.StatusCode)" $status "AUTH"
    } catch {
        $global:AllTestResults.AdminAuthentication.DashboardAccess = $false
        Write-Log "Admin dashboard access failed: $($_.Exception.Message)" "FAIL" "AUTH"
    }
}

function Test-AdminLogout {
    if (-not $global:AdminSession) {
        Write-Log "Skipped logout test - no session available" "WARN" "AUTH"
        return
    }

    try {
        $headers = @{ Cookie = $global:AdminSession }
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-logout" -Method POST -Headers $headers -UseBasicParsing -ErrorAction Stop

        $global:AllTestResults.AdminAuthentication.LogoutSuccess = ($response.StatusCode -eq 200)
        $status = if ($response.StatusCode -eq 200) { "PASS" } else { "FAIL" }
        Write-Log "Admin logout: $($response.StatusCode)" $status "AUTH"
    } catch {
        $global:AllTestResults.AdminAuthentication.LogoutSuccess = $false
        Write-Log "Admin logout failed: $($_.Exception.Message)" "FAIL" "AUTH"
    }
}

# === MIDDLEWARE PROTECTION TESTS ===
function Test-MiddlewareProtection {
    Write-Log "Starting Middleware Protection Tests" "INFO" "MIDDLEWARE"

    Test-UnauthenticatedRouteProtection
    Test-AdminRouteProtection
}

function Test-UnauthenticatedRouteProtection {
    $protectedRoutes = @("/admin", "/admin/dashboard", "/dashboard")
    $protectedCount = 0

    foreach ($route in $protectedRoutes) {
        try {
            $response = Invoke-WebRequest -Uri "$ServerUrl$route" -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue

            if ($response.StatusCode -ge 300 -and $response.StatusCode -lt 400) {
                $protectedCount++
                Write-Log "$route correctly redirects (Status: $($response.StatusCode))" "PASS" "MIDDLEWARE"
            } else {
                Write-Log "$route should redirect but
::contentReference[oaicite:5]{index=5}
 
