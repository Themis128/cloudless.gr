# Create Test User Script
Write-Host "Creating test user for authentication..." -ForegroundColor Green

$baseUrl = "http://localhost:3000/api/auth"

# Test user data
$userData = @{
  name     = "Test User"
  email    = "test@example.com"
  password = "password123"
}

Write-Host "`n1. Getting CSRF token..." -ForegroundColor Yellow
try {
  $csrfResponse = Invoke-WebRequest -Uri "$baseUrl/csrf" -Method POST -UseBasicParsing
  $csrfData = $csrfResponse.Content | ConvertFrom-Json
  $csrfToken = $csrfData.token

  Write-Host "✅ CSRF token obtained" -ForegroundColor Green

  # Get cookies from the response
  $cookies = $csrfResponse.Headers['Set-Cookie']

  Write-Host "`n2. Creating test user..." -ForegroundColor Yellow

  # Create headers with CSRF token
  $headers = @{
    "Content-Type" = "application/json"
    "x-csrf-token" = $csrfToken
  }

  $response = Invoke-WebRequest -Uri "$baseUrl/register" -Method POST -Body ($userData | ConvertTo-Json) -Headers $headers -UseBasicParsing
  $data = $response.Content | ConvertFrom-Json

  if ($data.success -eq $true) {
    Write-Host "✅ Test user created successfully" -ForegroundColor Green
    Write-Host "   Email: $($userData.email)" -ForegroundColor Gray
    Write-Host "   Password: $($userData.password)" -ForegroundColor Gray
  }
  else {
    Write-Host "❌ Failed to create test user" -ForegroundColor Red
    Write-Host "   Error: $($data.message)" -ForegroundColor Red
  }
}
catch {
  Write-Host "❌ Error creating test user: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Testing login with test user..." -ForegroundColor Yellow
try {
  $loginData = @{
    email    = $userData.email
    password = $userData.password
  }

  # Create headers with CSRF token for login
  $headers = @{
    "Content-Type" = "application/json"
    "x-csrf-token" = $csrfToken
  }

  $response = Invoke-WebRequest -Uri "$baseUrl/login" -Method POST -Body ($loginData | ConvertTo-Json) -Headers $headers -UseBasicParsing
  $data = $response.Content | ConvertFrom-Json

  if ($data.success -eq $true) {
    Write-Host "✅ Login successful" -ForegroundColor Green
    Write-Host "   Token received: $($data.token.Substring(0, 20))..." -ForegroundColor Gray
  }
  else {
    Write-Host "❌ Login failed" -ForegroundColor Red
    Write-Host "   Error: $($data.message)" -ForegroundColor Red
  }
}
catch {
  Write-Host "❌ Error testing login: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest user setup completed!" -ForegroundColor Green
Write-Host "You can now use these credentials to log in:" -ForegroundColor Yellow
Write-Host "Email: $($userData.email)" -ForegroundColor White
Write-Host "Password: $($userData.password)" -ForegroundColor White
