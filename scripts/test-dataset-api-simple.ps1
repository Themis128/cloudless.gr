# Simple Dataset API Test (without file uploads)
Write-Host "Testing Dataset API Endpoints (Simple Version)..." -ForegroundColor Green

$baseUrl = "http://localhost:3000/api/llm/datasets"

# Test 1: Get all datasets
Write-Host "`n1. Testing GET /api/llm/datasets" -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri $baseUrl -UseBasicParsing
  $data = $response.Content | ConvertFrom-Json

  if ($data.success -eq $true) {
    Write-Host "✅ GET datasets successful" -ForegroundColor Green
    Write-Host "   Found $($data.data.Count) datasets" -ForegroundColor Gray
  }
  else {
    Write-Host "❌ GET datasets failed" -ForegroundColor Red
  }
}
catch {
  Write-Host "❌ GET datasets error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Create a dataset (without file)
Write-Host "`n2. Testing POST /api/llm/datasets (without file)" -ForegroundColor Yellow
try {
  $formData = @{
    name        = "Test Dataset"
    description = "A test dataset for validation"
    type        = "text-generation"
    format      = "json"
  }

  $response = Invoke-WebRequest -Uri $baseUrl -Method POST -Body $formData -UseBasicParsing
  $data = $response.Content | ConvertFrom-Json

  if ($data.success -eq $true) {
    Write-Host "✅ POST dataset successful" -ForegroundColor Green
    Write-Host "   Created dataset: $($data.data.name)" -ForegroundColor Gray
    $datasetId = $data.data.id
  }
  else {
    Write-Host "❌ POST dataset failed" -ForegroundColor Red
    $datasetId = $null
  }
}
catch {
  Write-Host "❌ POST dataset error: $($_.Exception.Message)" -ForegroundColor Red
  $datasetId = $null
}

# Test 3: Get specific dataset
if ($datasetId) {
  Write-Host "`n3. Testing GET /api/llm/datasets/$datasetId" -ForegroundColor Yellow
  try {
    $response = Invoke-WebRequest -Uri "$baseUrl`?id=$datasetId" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json

    if ($data.success -eq $true) {
      Write-Host "✅ GET specific dataset successful" -ForegroundColor Green
      Write-Host "   Retrieved dataset: $($data.data.name)" -ForegroundColor Gray
    }
    else {
      Write-Host "❌ GET specific dataset failed" -ForegroundColor Red
    }
  }
  catch {
    Write-Host "❌ GET specific dataset error: $($_.Exception.Message)" -ForegroundColor Red
  }
}

# Test 4: Test datasets page
Write-Host "`n4. Testing datasets page" -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri "http://localhost:3000/llm/datasets" -UseBasicParsing

  if ($response.StatusCode -eq 200) {
    Write-Host "✅ Datasets page loads successfully" -ForegroundColor Green
  }
  else {
    Write-Host "❌ Datasets page failed to load" -ForegroundColor Red
  }
}
catch {
  Write-Host "❌ Datasets page error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nSimple Dataset API testing completed!" -ForegroundColor Green
