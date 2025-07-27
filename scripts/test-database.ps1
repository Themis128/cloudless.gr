# Test Database Connection
Write-Host "Testing database connection..." -ForegroundColor Green

$baseUrl = "http://localhost:3000/api"

Write-Host "`n1. Testing basic API endpoint..." -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing -ErrorAction SilentlyContinue
  if ($response.StatusCode -eq 200) {
    Write-Host "✅ Health endpoint working" -ForegroundColor Green
  }
  else {
    Write-Host "❌ Health endpoint returned status: $($response.StatusCode)" -ForegroundColor Red
  }
}
catch {
  Write-Host "❌ Health endpoint not available" -ForegroundColor Red
}

Write-Host "`n2. Testing datasets endpoint (should work)..." -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri "$baseUrl/llm/datasets" -UseBasicParsing
  $data = $response.Content | ConvertFrom-Json

  if ($data.success -eq $true) {
    Write-Host "✅ Datasets endpoint working" -ForegroundColor Green
    Write-Host "   Found $($data.data.Count) datasets" -ForegroundColor Gray
  }
  else {
    Write-Host "❌ Datasets endpoint failed" -ForegroundColor Red
  }
}
catch {
  Write-Host "❌ Datasets endpoint error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Testing auth endpoints..." -ForegroundColor Yellow

# Test login endpoint
try {
  $loginData = @{
    email    = "test@example.com"
    password = "password123"
  }

  $response = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -Body $loginData -UseBasicParsing
  Write-Host "✅ Login endpoint accessible" -ForegroundColor Green
}
catch {
  Write-Host "❌ Login endpoint error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test register endpoint
try {
  $registerData = @{
    name     = "Test User"
    email    = "test2@example.com"
    password = "password123"
  }

  $response = Invoke-WebRequest -Uri "$baseUrl/auth/register" -Method POST -Body $registerData -UseBasicParsing
  Write-Host "✅ Register endpoint accessible" -ForegroundColor Green
}
catch {
  Write-Host "❌ Register endpoint error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nDatabase connection test completed!" -ForegroundColor Green
