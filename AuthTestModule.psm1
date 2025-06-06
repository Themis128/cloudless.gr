# Authentication Testing Module
# Reusable PowerShell module for authentication testing across environments

class AuthTestSuite {
    [string]$ServerUrl
    [string]$AdminEmail
    [string]$AdminPassword
    [hashtable]$TestResults
    [array]$TestErrors
    [string]$AdminSession
    [string]$AdminToken
    [string]$Environment
    
    AuthTestSuite([string]$serverUrl, [string]$environment = "development") {
        $this.ServerUrl = $serverUrl
        $this.Environment = $environment
        $this.TestResults = @{}
        $this.TestErrors = @()
        $this.LoadCredentials()
    }
    
    [void]LoadCredentials() {
        # Default credentials
        $this.AdminEmail = "admin@cloudless.gr"
        $this.AdminPassword = "cloudless2025"
        
        # Load from environment variables (CI/CD)
        if ($env:ADMIN_EMAIL) { $this.AdminEmail = $env:ADMIN_EMAIL }
        if ($env:ADMIN_PASSWORD) { $this.AdminPassword = $env:ADMIN_PASSWORD }
        
        # Load from .env file (local development)
        if (Test-Path ".env") {
            $envContent = Get-Content ".env"
            foreach ($line in $envContent) {
                if ($line -match "^ADMIN_EMAIL=(.+)$") { $this.AdminEmail = $matches[1] }
                if ($line -match "^ADMIN_PASSWORD=(.+)$") { $this.AdminPassword = $matches[1] }
            }
        }
    }
    
    [void]WriteLog([string]$message, [string]$level = "INFO", [string]$category = "TEST") {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $color = switch ($level) {
            "PASS" { "Green" }
            "FAIL" { "Red" }
            "WARN" { "Yellow" }
            "INFO" { "Cyan" }
            default { "White" }
        }
        $entry = "$timestamp [$level][$category] $message"
        Write-Host $entry -ForegroundColor $color
        
        # Log to file based on environment
        $logFile = if ($this.Environment -eq "ci") { "ci-auth-test.log" } else { "auth-test.log" }
        Add-Content -Path $logFile -Value $entry -ErrorAction SilentlyContinue
    }
    
    [bool]TestServerAvailability() {
        $this.WriteLog("Testing server availability at $($this.ServerUrl)", "INFO", "SERVER")
        
        for ($i = 1; $i -le 10; $i++) {
            try {
                $response = Invoke-WebRequest -Uri $this.ServerUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
                if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 307) {
                    $this.WriteLog("Server is available (HTTP $($response.StatusCode))", "PASS", "SERVER")
                    $this.TestResults.ServerAvailable = $true
                    return $true
                }
            } catch {
                if ($i -lt 10) {
                    $this.WriteLog("Attempt $i failed, retrying...", "WARN", "SERVER")
                    Start-Sleep -Seconds 2
                }
            }
        }
        
        $this.WriteLog("Server unavailable after 10 attempts", "FAIL", "SERVER")
        $this.TestResults.ServerAvailable = $false
        $this.TestErrors += "Server unavailable"
        return $false
    }
    
    [bool]TestAdminLogin() {
        $this.WriteLog("Testing admin login", "INFO", "AUTH")
        
        try {
            $loginData = @{ 
                email = $this.AdminEmail
                password = $this.AdminPassword 
            } | ConvertTo-Json -Compress
            
            $response = Invoke-WebRequest -Uri "$($this.ServerUrl)/api/auth/admin-login" -Method POST -Body $loginData -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
            $json = $response.Content | ConvertFrom-Json
            
            if ($json.success) {
                $this.AdminToken = $json.token
                $setCookieHeader = $response.Headers["Set-Cookie"]
                $this.AdminSession = if ($setCookieHeader) { $setCookieHeader } else { "admin-token=" + $json.token }
                
                $this.WriteLog("Admin login successful", "PASS", "AUTH")
                $this.TestResults.AdminLogin = $true
                return $true
            } else {
                throw "API returned success=false: $($json.message)"
            }
        } catch {
            $this.WriteLog("Admin login failed: $($_.Exception.Message)", "FAIL", "AUTH")
            $this.TestResults.AdminLogin = $false
            $this.TestErrors += "Admin login failed"
            return $false
        }
    }
    
    [bool]TestInvalidLogin() {
        $this.WriteLog("Testing invalid login rejection", "INFO", "AUTH")
        
        try {
            $invalidData = @{ 
                email = "hacker@evil.com"
                password = "wrongpassword" 
            } | ConvertTo-Json -Compress
            
            $response = Invoke-WebRequest -Uri "$($this.ServerUrl)/api/auth/admin-login" -Method POST -Body $invalidData -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue
            $json = $response.Content | ConvertFrom-Json
            
            $rejected = (-not $json.success)
            $this.TestResults.InvalidLoginRejected = $rejected
            
            if ($rejected) {
                $this.WriteLog("Invalid login correctly rejected", "PASS", "AUTH")
                return $true
            } else {
                $this.WriteLog("Invalid login was accepted (security issue)", "FAIL", "AUTH")
                $this.TestErrors += "Invalid login accepted"
                return $false
            }
        } catch {
            $this.WriteLog("Invalid login properly rejected", "PASS", "AUTH")
            $this.TestResults.InvalidLoginRejected = $true
            return $true
        }
    }
    
    [bool]TestMiddlewareProtection() {
        $this.WriteLog("Testing middleware protection", "INFO", "MIDDLEWARE")
        
        $protectedRoutes = @("/admin", "/admin/dashboard", "/dashboard")
        $protectedCount = 0
        
        foreach ($route in $protectedRoutes) {
            try {
                $response = Invoke-WebRequest -Uri "$($this.ServerUrl)$route" -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue
                
                if ($response.StatusCode -ge 300 -and $response.StatusCode -lt 400) {
                    $protectedCount++
                    $this.WriteLog("$route correctly protected (redirects)", "PASS", "MIDDLEWARE")
                } else {
                    $this.WriteLog("$route not properly protected", "FAIL", "MIDDLEWARE")
                }
            } catch {
                if ($_.Exception.Message -like "*redirect*" -or $_.Exception.Message -like "*307*") {
                    $protectedCount++
                    $this.WriteLog("$route correctly protected (middleware)", "PASS", "MIDDLEWARE")
                }
            }
        }
        
        $allProtected = ($protectedCount -eq $protectedRoutes.Count)
        $this.TestResults.MiddlewareProtection = $allProtected
        
        if ($allProtected) {
            $this.WriteLog("All protected routes properly secured", "PASS", "MIDDLEWARE")
        } else {
            $this.WriteLog("Some routes not properly protected", "FAIL", "MIDDLEWARE")
            $this.TestErrors += "Middleware protection incomplete"
        }
        
        return $allProtected
    }
    
    [bool]TestJWTValidation() {
        if (-not $this.AdminToken) {
            $this.WriteLog("No JWT token available for validation", "WARN", "JWT")
            return $false
        }
        
        $this.WriteLog("Testing JWT token validation", "INFO", "JWT")
        
        try {
            $parts = $this.AdminToken.Split('.')
            
            if ($parts.Length -ne 3) {
                throw "JWT should have 3 parts, found $($parts.Length)"
            }
            
            # Decode payload
            $payload64 = $parts[1]
            # Add padding if needed
            $padding = 4 - ($payload64.Length % 4)
            if ($padding -ne 4) { $payload64 += "=" * $padding }
            
            # Convert URL-safe to standard base64
            $payload64 = $payload64.Replace('-', '+').Replace('_', '/')
            $payloadBytes = [Convert]::FromBase64String($payload64)
            $payloadJson = [System.Text.Encoding]::UTF8.GetString($payloadBytes)
            $payload = $payloadJson | ConvertFrom-Json
            
            # Validate claims
            $requiredClaims = @("id", "email", "role", "iat", "exp")
            $missingClaims = @()
            
            foreach ($claim in $requiredClaims) {
                if (-not $payload.PSObject.Properties[$claim]) {
                    $missingClaims += $claim
                }
            }
            
            if ($missingClaims.Count -eq 0) {
                # Check expiration
                $expiresAt = [DateTimeOffset]::FromUnixTimeSeconds($payload.exp)
                $now = [DateTimeOffset]::UtcNow
                
                if ($expiresAt -gt $now) {
                    $this.WriteLog("JWT token validation passed", "PASS", "JWT")
                    $this.TestResults.JWTValid = $true
                    return $true
                } else {
                    throw "JWT token is expired"
                }
            } else {
                throw "Missing required claims: $($missingClaims -join ', ')"
            }
        } catch {
            $this.WriteLog("JWT validation failed: $($_.Exception.Message)", "FAIL", "JWT")
            $this.TestResults.JWTValid = $false
            $this.TestErrors += "JWT validation failed"
            return $false
        }
    }
    
    [hashtable]RunFullTestSuite() {
        $this.WriteLog("Starting complete authentication test suite", "INFO", "SUITE")
        $this.WriteLog("Environment: $($this.Environment)", "INFO", "SUITE")
        $this.WriteLog("Server: $($this.ServerUrl)", "INFO", "SUITE")
        $this.WriteLog("Admin Email: $($this.AdminEmail)", "INFO", "SUITE")
        
        $startTime = Get-Date
        
        # Run all tests
        $serverOk = $this.TestServerAvailability()
        $loginOk = if ($serverOk) { $this.TestAdminLogin() } else { $false }
        $invalidOk = if ($serverOk) { $this.TestInvalidLogin() } else { $false }
        $middlewareOk = if ($serverOk) { $this.TestMiddlewareProtection() } else { $false }
        $jwtOk = if ($loginOk) { $this.TestJWTValidation() } else { $false }
        
        $endTime = Get-Date
        $duration = $endTime - $startTime
        
        # Calculate results
        $totalTests = $this.TestResults.Count
        $passedTests = ($this.TestResults.Values | Where-Object { $_ -eq $true }).Count
        $successRate = if ($totalTests -gt 0) { [Math]::Round(($passedTests / $totalTests) * 100, 2) } else { 0 }
        
        $this.WriteLog("Test suite completed in $($duration.TotalSeconds.ToString('F2')) seconds", "INFO", "SUITE")
        $this.WriteLog("Results: $passedTests/$totalTests tests passed ($successRate%)", $(if ($successRate -ge 90) { "PASS" } else { "FAIL" }), "SUITE")
        
        if ($this.TestErrors.Count -gt 0) {
            $this.WriteLog("Errors encountered:", "FAIL", "SUITE")
            foreach ($error in $this.TestErrors) {
                $this.WriteLog("- $error", "FAIL", "SUITE")
            }
        }
        
        return @{
            TotalTests = $totalTests
            PassedTests = $passedTests
            FailedTests = $totalTests - $passedTests
            SuccessRate = $successRate
            Errors = $this.TestErrors
            Results = $this.TestResults
            Duration = $duration.TotalSeconds
            Environment = $this.Environment
        }
    }
    
    [void]GenerateReport([string]$filePath = "auth-test-report.json") {
        $summary = $this.RunFullTestSuite()
        
        $report = @{
            TestSuite = "Authentication Test Suite"
            Timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss UTC')
            Environment = $this.Environment
            ServerUrl = $this.ServerUrl
            Summary = $summary
            DetailedResults = $this.TestResults
            Errors = $this.TestErrors
        }
        
        $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $filePath -Encoding UTF8
        $this.WriteLog("Test report generated: $filePath", "INFO", "REPORT")
    }
}

# Export the class for use in other scripts
# Note: PowerShell classes are automatically exported in modules
