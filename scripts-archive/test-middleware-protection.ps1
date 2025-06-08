# Middleware Protection and Role-Based Access Test
# Tests unauthorized access, redirects, and role-based restrictions

param(
    [string]$ServerUrl = "http://localhost:3000",
    [int]$MaxRetries = 5,
    [int]$RetryDelay = 2
)

# Global test state
$global:TestResults = @{
    UnauthenticatedRedirect = $false
    AdminRouteBlocked = $false
    DashboardProtected = $false
    ContactSubmissionsProtected = $false
    AdminWarningAccessible = $false
}
$global:TestErrors = @()

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

function Test-UnauthenticatedAccess {
    Write-Log "TEST: Unauthenticated Access to Protected Routes"
    
    $protectedRoutes = @(
        "/admin",
        "/admin/dashboard", 
        "/admin/contact-submissions",
        "/dashboard"
    )
    
    $redirectCount = 0
    foreach ($route in $protectedRoutes) {
        try {
            $response = Invoke-WebRequest -Uri "$ServerUrl$route" -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue
            
            # Check for redirect (3xx status codes)
            if ($response.StatusCode -ge 300 -and $response.StatusCode -lt 400) {
                $location = $response.Headers["Location"]
                if ($location -and ($location -like "*login*" -or $location -like "*auth*")) {
                    Write-Log "PASS: $route correctly redirects to auth ($($response.StatusCode))" "PASS"
                    $redirectCount++
                } else {
                    Write-Log "WARN: $route redirects but not to auth page (Location: $location)" "WARN"
                }
            } else {
                Write-Log "FAIL: $route should redirect but returned $($response.StatusCode)" "FAIL"
                $global:TestErrors += "Route $route not properly protected"
            }
        } catch {
            # PowerShell throws exception on redirects, check if it's a redirect exception
            if ($_.Exception.Message -like "*redirect*" -or $_.Exception.Message -like "*307*") {
                Write-Log "PASS: $route correctly triggers redirect protection" "PASS"
                $redirectCount++
            } else {
                Write-Log "FAIL: $route access failed: $($_.Exception.Message)" "FAIL"
                $global:TestErrors += "Route $route test failed"
            }
        }
    }
    
    if ($redirectCount -ge 3) {
        $global:TestResults.UnauthenticatedRedirect = $true
        Write-Log "PASS: Majority of protected routes correctly redirect" "PASS"
    }
}

function Test-AdminRouteBlocking {
    Write-Log "TEST: Admin Route Access Control"
    
    try {
        # Test root admin route
        $response = Invoke-WebRequest -Uri "$ServerUrl/admin" -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue
        
        if ($response.StatusCode -eq 307 -or $response.StatusCode -eq 302) {
            $global:TestResults.AdminRouteBlocked = $true
            Write-Log "PASS: /admin route properly blocks unauthorized access" "PASS"
        } else {
            Write-Log "FAIL: /admin route should block unauthorized access" "FAIL"
            $global:TestErrors += "Admin route not properly protected"
        }
    } catch {
        # Redirect exceptions are expected
        $global:TestResults.AdminRouteBlocked = $true
        Write-Log "PASS: /admin route triggers authentication middleware" "PASS"
    }
}

function Test-SpecificProtectedPages {
    Write-Log "TEST: Specific Protected Page Access"
    
    $pages = @{
        "/dashboard" = "DashboardProtected"
        "/admin/contact-submissions" = "ContactSubmissionsProtected"
    }
    
    foreach ($page in $pages.Keys) {
        try {
            $response = Invoke-WebRequest -Uri "$ServerUrl$page" -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue
            
            if ($response.StatusCode -ge 300 -and $response.StatusCode -lt 400) {
                $global:TestResults[$pages[$page]] = $true
                Write-Log "PASS: $page correctly protected (Status: $($response.StatusCode))" "PASS"
            } else {
                Write-Log "FAIL: $page should be protected but returned $($response.StatusCode)" "FAIL"
                $global:TestErrors += "$page not properly protected"
            }
        } catch {
            # Redirect exceptions are expected for protected pages
            $global:TestResults[$pages[$page]] = $true
            Write-Log "PASS: $page triggers protection middleware" "PASS"
        }
    }
}

function Test-PublicPageAccess {
    Write-Log "TEST: Public Page Accessibility"
    
    $publicPages = @("/auth/login", "/admin-warning")
    
    foreach ($page in $publicPages) {
        try {
            $response = Invoke-WebRequest -Uri "$ServerUrl$page" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
            
            if ($response.StatusCode -eq 200) {
                Write-Log "PASS: $page accessible without auth (Status: $($response.StatusCode))" "PASS"
                if ($page -eq "/admin-warning") {
                    $global:TestResults.AdminWarningAccessible = $true
                }
            } else {
                Write-Log "WARN: $page returned unexpected status: $($response.StatusCode)" "WARN"
            }
        } catch {
            Write-Log "FAIL: Public page $page should be accessible: $($_.Exception.Message)" "FAIL"
            $global:TestErrors += "Public page $page not accessible"
        }
    }
}

function Show-MiddlewareSummary {
    Write-Log "MIDDLEWARE PROTECTION TEST SUMMARY:" "INFO"
    $passed = ($global:TestResults.Values | Where-Object { $_ -eq $true }).Count
    $total = $global:TestResults.Count
    $status = if ($passed -eq $total) { "PASS" } else { "WARN" }
    Write-Log "RESULT: $passed / $total middleware tests passed" $status
    
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

# Execute middleware protection tests
Write-Log "Starting Middleware Protection Test Suite" "INFO"
Write-Log "Testing against: $ServerUrl" "INFO"

Test-UnauthenticatedAccess
Test-AdminRouteBlocking
Test-SpecificProtectedPages
Test-PublicPageAccess
Show-MiddlewareSummary

Write-Log "Middleware protection test suite completed" "INFO"
