# Test Dataset API Endpoints
Write-Host "Testing Dataset API Endpoints..." -ForegroundColor Green

$baseUrl = "http://localhost:3002/api/llm/datasets"

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

# Test 2: Create a dataset
Write-Host "`n2. Testing POST /api/llm/datasets" -ForegroundColor Yellow
try {
  # Create a simple test file
  $testFileContent = '{"text": "This is a test dataset", "label": "test"}'
  $testFilePath = "test-dataset.json"
  $testFileContent | Out-File -FilePath $testFilePath -Encoding UTF8

  # Create multipart form data
  $boundary = [System.Guid]::NewGuid().ToString()
  $LF = "`r`n"

  $bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"name`"",
    "",
    "Test Dataset",
    "--$boundary",
    "Content-Disposition: form-data; name=`"description`"",
    "",
    "A test dataset for validation",
    "--$boundary",
    "Content-Disposition: form-data; name=`"type`"",
    "",
    "text-generation",
    "--$boundary",
    "Content-Disposition: form-data; name=`"format`"",
    "",
    "json",
    "--$boundary",
    "Content-Disposition: form-data; name=`"file`"; filename=`"test-dataset.json`"",
    "Content-Type: application/json",
    "",
    $testFileContent,
    "--$boundary--"
  )

  $body = $bodyLines -join $LF

  $headers = @{
    "Content-Type" = "multipart/form-data; boundary=$boundary"
  }

  $response = Invoke-WebRequest -Uri $baseUrl -Method POST -Body $body -Headers $headers -UseBasicParsing
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

  # Clean up test file
  if (Test-Path $testFilePath) {
    Remove-Item $testFilePath
  }
}
catch {
  Write-Host "❌ POST dataset error: $($_.Exception.Message)" -ForegroundColor Red
  $datasetId = $null

  # Clean up test file
  if (Test-Path $testFilePath) {
    Remove-Item $testFilePath
  }
}

# Test 3: Get specific dataset
if ($datasetId) {
  Write-Host "`n3. Testing GET /api/llm/datasets/$datasetId" -ForegroundColor Yellow
  try {
    $response = Invoke-WebRequest -Uri "$baseUrl?id=$datasetId" -UseBasicParsing
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
  $response = Invoke-WebRequest -Uri "http://localhost:3002/llm/datasets" -UseBasicParsing

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

Write-Host "`nDataset API testing completed!" -ForegroundColor Green
