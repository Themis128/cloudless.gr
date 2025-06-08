# JWT Token Validation Test
# Validates JWT token structure, claims, and expiration

param(
    [string]$ServerUrl = "http://localhost:3000"
)

# Load credentials from .env file
$AdminEmail = "admin@cloudless.gr"
$AdminPassword = "cloudless2025"

if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^ADMIN_EMAIL=(.+)$") { $AdminEmail = $matches[1] }
        if ($line -match "^ADMIN_PASSWORD=(.+)$") { $AdminPassword = $matches[1] }
    }
}

# Global test state
$global:TestResults = @{
    TokenGenerated = $false
    TokenStructure = $false
    TokenClaims = $false
    TokenExpiration = $false
    TokenSignature = $false
}
$global:TestErrors = @()
$global:AdminToken = $null

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

function ConvertFrom-Base64Url {
    param([string]$base64Url)
    
    # Add padding if needed
    $padding = 4 - ($base64Url.Length % 4)
    if ($padding -ne 4) {
        $base64Url += "=" * $padding
    }
    
    # Convert URL-safe characters back to standard base64
    $base64 = $base64Url.Replace('-', '+').Replace('_', '/')
    
    try {
        $bytes = [Convert]::FromBase64String($base64)
        return [System.Text.Encoding]::UTF8.GetString($bytes)
    } catch {
        throw "Failed to decode base64: $($_.Exception.Message)"
    }
}

function Get-AdminToken {
    Write-Log "TEST: Obtaining Admin Token"
    
    try {
        $loginData = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json -Compress
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/auth/admin-login" -Method POST -Body $loginData -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        $json = $response.Content | ConvertFrom-Json
        
        if ($json.success -and $json.token) {
            $global:AdminToken = $json.token
            $global:TestResults.TokenGenerated = $true
            Write-Log "PASS: Admin token obtained successfully" "PASS"
            Write-Log "Token (first 50 chars): $($json.token.Substring(0, [Math]::Min(50, $json.token.Length)))..." "INFO"
        } else {
            throw "Login failed or no token returned"
        }
    } catch {
        Write-Log "FAIL: Failed to obtain admin token: $($_.Exception.Message)" "FAIL"
        $global:TestErrors += "Token generation failed"
    }
}

function Test-TokenStructure {
    Write-Log "TEST: JWT Token Structure"
    
    if (-not $global:AdminToken) {
        Write-Log "FAIL: No token available for testing" "FAIL"
        return
    }
    
    try {
        $parts = $global:AdminToken.Split('.')
        
        if ($parts.Length -eq 3) {
            $global:TestResults.TokenStructure = $true
            Write-Log "PASS: JWT has correct structure (3 parts: header.payload.signature)" "PASS"
            Write-Log "Header length: $($parts[0].Length)" "INFO"
            Write-Log "Payload length: $($parts[1].Length)" "INFO"
            Write-Log "Signature length: $($parts[2].Length)" "INFO"
        } else {
            throw "JWT should have exactly 3 parts, found $($parts.Length)"
        }
    } catch {
        Write-Log "FAIL: Invalid JWT structure: $($_.Exception.Message)" "FAIL"
        $global:TestErrors += "JWT structure validation failed"
    }
}

function Test-TokenClaims {
    Write-Log "TEST: JWT Token Claims"
    
    if (-not $global:AdminToken) {
        Write-Log "FAIL: No token available for testing" "FAIL"
        return
    }
    
    try {
        $parts = $global:AdminToken.Split('.')
        
        # Decode header
        $headerJson = ConvertFrom-Base64Url $parts[0]
        $header = $headerJson | ConvertFrom-Json
        Write-Log "Header: $headerJson" "INFO"
        
        # Decode payload
        $payloadJson = ConvertFrom-Base64Url $parts[1]
        $payload = $payloadJson | ConvertFrom-Json
        Write-Log "Payload: $payloadJson" "INFO"
        
        # Validate required claims
        $requiredClaims = @("id", "email", "role", "iat", "exp")
        $missingClaims = @()
        
        foreach ($claim in $requiredClaims) {
            if (-not $payload.PSObject.Properties[$claim]) {
                $missingClaims += $claim
            }
        }
        
        if ($missingClaims.Count -eq 0) {
            $global:TestResults.TokenClaims = $true
            Write-Log "PASS: All required claims present" "PASS"
            Write-Log "User ID: $($payload.id)" "INFO"
            Write-Log "Email: $($payload.email)" "INFO"
            Write-Log "Role: $($payload.role)" "INFO"
            
            # Validate specific claim values
            if ($payload.email -eq $AdminEmail) {
                Write-Log "PASS: Email claim matches expected admin email" "PASS"
            } else {
                Write-Log "WARN: Email claim mismatch. Expected: $AdminEmail, Got: $($payload.email)" "WARN"
            }
            
            if ($payload.role -eq "admin") {
                Write-Log "PASS: Role claim is correctly set to 'admin'" "PASS"
            } else {
                Write-Log "WARN: Role claim incorrect. Expected: admin, Got: $($payload.role)" "WARN"
            }
        } else {
            throw "Missing required claims: $($missingClaims -join ', ')"
        }
    } catch {
        Write-Log "FAIL: JWT claims validation failed: $($_.Exception.Message)" "FAIL"
        $global:TestErrors += "JWT claims validation failed"
    }
}

function Test-TokenExpiration {
    Write-Log "TEST: JWT Token Expiration"
    
    if (-not $global:AdminToken) {
        Write-Log "FAIL: No token available for testing" "FAIL"
        return
    }
    
    try {
        $parts = $global:AdminToken.Split('.')
        $payloadJson = ConvertFrom-Base64Url $parts[1]
        $payload = $payloadJson | ConvertFrom-Json
        
        if ($payload.PSObject.Properties["iat"] -and $payload.PSObject.Properties["exp"]) {
            $issuedAt = [DateTimeOffset]::FromUnixTimeSeconds($payload.iat)
            $expiresAt = [DateTimeOffset]::FromUnixTimeSeconds($payload.exp)
            $now = [DateTimeOffset]::UtcNow
            
            Write-Log "Issued At: $($issuedAt.ToString('yyyy-MM-dd HH:mm:ss UTC'))" "INFO"
            Write-Log "Expires At: $($expiresAt.ToString('yyyy-MM-dd HH:mm:ss UTC'))" "INFO"
            Write-Log "Current Time: $($now.ToString('yyyy-MM-dd HH:mm:ss UTC'))" "INFO"
            
            $timeToExpiry = $expiresAt - $now
            Write-Log "Time to expiry: $($timeToExpiry.TotalHours.ToString('F2')) hours" "INFO"
            
            if ($expiresAt -gt $now) {
                $global:TestResults.TokenExpiration = $true
                Write-Log "PASS: Token is not expired and has valid expiration time" "PASS"
                
                # Check if expiration is reasonable (between 1 hour and 48 hours)
                if ($timeToExpiry.TotalHours -ge 1 -and $timeToExpiry.TotalHours -le 48) {
                    Write-Log "PASS: Token expiration time is within reasonable range" "PASS"
                } else {
                    Write-Log "WARN: Token expiration time seems unusual ($($timeToExpiry.TotalHours.ToString('F2')) hours)" "WARN"
                }
            } else {
                throw "Token is expired"
            }
        } else {
            throw "Token missing iat or exp claims"
        }
    } catch {
        Write-Log "FAIL: JWT expiration validation failed: $($_.Exception.Message)" "FAIL"
        $global:TestErrors += "JWT expiration validation failed"
    }
}

function Test-TokenSignature {
    Write-Log "TEST: JWT Token Signature Verification"
    
    if (-not $global:AdminToken) {
        Write-Log "FAIL: No token available for testing" "FAIL"
        return
    }
    
    try {
        $parts = $global:AdminToken.Split('.')
        
        # Check if signature exists and has reasonable length
        if ($parts[2].Length -gt 10) {
            $global:TestResults.TokenSignature = $true
            Write-Log "PASS: Token has signature of reasonable length ($($parts[2].Length) chars)" "PASS"
            Write-Log "Signature (first 20 chars): $($parts[2].Substring(0, [Math]::Min(20, $parts[2].Length)))..." "INFO"
            
            # Note: Full signature verification would require the JWT secret, 
            # which should not be exposed in tests for security reasons
            Write-Log "INFO: Full signature verification requires JWT secret (not exposed for security)" "INFO"
        } else {
            throw "Token signature appears to be too short or missing"
        }
    } catch {
        Write-Log "FAIL: JWT signature validation failed: $($_.Exception.Message)" "FAIL"
        $global:TestErrors += "JWT signature validation failed"
    }
}

function Show-TokenSummary {
    Write-Log "JWT TOKEN VALIDATION TEST SUMMARY:" "INFO"
    $passed = ($global:TestResults.Values | Where-Object { $_ -eq $true }).Count
    $total = $global:TestResults.Count
    $status = if ($passed -eq $total) { "PASS" } else { "WARN" }
    Write-Log "RESULT: $passed / $total token validation tests passed" $status
    
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

# Execute JWT validation tests
Write-Log "Starting JWT Token Validation Test Suite" "INFO"
Write-Log "Testing against: $ServerUrl" "INFO"

Get-AdminToken
Test-TokenStructure
Test-TokenClaims
Test-TokenExpiration
Test-TokenSignature
Show-TokenSummary

Write-Log "JWT token validation test suite completed" "INFO"
