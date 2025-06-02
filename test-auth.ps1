# Test authentication endpoints
$body = @{
    email = "user@cloudless.gr"
    password = "demo123"
} | ConvertTo-Json

try {
    Write-Host "Testing user login endpoint..."
    $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/user-login' -Method POST -ContentType 'application/json' -Body $body
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "❌ Login failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# Test signup endpoint
$signupBody = @{
    email = "test@example.com"
    password = "testpassword123"
    firstName = "Test"
    lastName = "User"
} | ConvertTo-Json

try {
    Write-Host "`nTesting user signup endpoint..."
    $signupResponse = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/user-signup' -Method POST -ContentType 'application/json' -Body $signupBody
    Write-Host "✅ Signup successful!" -ForegroundColor Green
    Write-Host ($signupResponse | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "❌ Signup failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# Test admin login endpoint
$adminBody = @{
    email = "admin"
    password = "cloudless2025"
} | ConvertTo-Json

try {
    Write-Host "`nTesting admin login endpoint..."
    $adminResponse = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/admin-login' -Method POST -ContentType 'application/json' -Body $adminBody
    Write-Host "✅ Admin login successful!" -ForegroundColor Green
    Write-Host ($adminResponse | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "❌ Admin login failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
