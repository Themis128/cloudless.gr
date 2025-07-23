# RBAC Authentication System Test Runner
# This script runs comprehensive tests for the RBAC authentication system

param(
    [string]$Environment = "development",
    [string]$TestType = "all",
    [switch]$Verbose,
    [switch]$Headless = $false,
    [switch]$GenerateReport = $true
)

Write-Host "🔐 RBAC Authentication System Test Runner" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Configuration
$TEST_TIMEOUT = 60000  # 60 seconds
$BASE_URL = "http://localhost:3001"
$TEST_RESULTS_DIR = "test-results"
$REPORTS_DIR = "test-reports"

# Create directories
if (!(Test-Path $TEST_RESULTS_DIR)) {
    New-Item -ItemType Directory -Path $TEST_RESULTS_DIR | Out-Null
    Write-Host "✅ Created test results directory" -ForegroundColor Green
}

if (!(Test-Path $REPORTS_DIR)) {
    New-Item -ItemType Directory -Path $REPORTS_DIR | Out-Null
    Write-Host "✅ Created reports directory" -ForegroundColor Green
}

# Test configuration
$TEST_CONFIG = @{
    timeout = $TEST_TIMEOUT
    baseUrl = $BASE_URL
    headless = $Headless
    verbose = $Verbose
    generateReport = $GenerateReport
}

Write-Host "📋 Test Configuration:" -ForegroundColor Yellow
Write-Host "  Environment: $Environment" -ForegroundColor White
Write-Host "  Test Type: $TestType" -ForegroundColor White
Write-Host "  Base URL: $BASE_URL" -ForegroundColor White
Write-Host "  Headless: $Headless" -ForegroundColor White
Write-Host "  Verbose: $Verbose" -ForegroundColor White
Write-Host "  Generate Report: $GenerateReport" -ForegroundColor White

# Check if server is running
Write-Host "`n🔍 Checking server status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/health" -TimeoutSec 10 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Server is running" -ForegroundColor Green
    } else {
        Write-Host "❌ Server returned status code: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Server is not running or not accessible" -ForegroundColor Red
    Write-Host "   Please start the development server with: npm run dev" -ForegroundColor Yellow
    exit 1
}

# Check if Playwright is installed
Write-Host "`n🔍 Checking Playwright installation..." -ForegroundColor Yellow
try {
    $playwrightVersion = npx playwright --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Playwright is installed: $playwrightVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Playwright is not installed" -ForegroundColor Red
        Write-Host "   Installing Playwright..." -ForegroundColor Yellow
        npm install -D @playwright/test
        npx playwright install
    }
} catch {
    Write-Host "❌ Error checking Playwright installation" -ForegroundColor Red
    exit 1
}

# Install Playwright browsers if needed
Write-Host "`n🔍 Checking Playwright browsers..." -ForegroundColor Yellow
try {
    npx playwright install-deps
    Write-Host "✅ Playwright browsers are ready" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Warning: Could not verify Playwright browsers" -ForegroundColor Yellow
}

# Run tests based on type
Write-Host "`n🚀 Starting test execution..." -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$testResultsFile = "$TEST_RESULTS_DIR/rbac-test-results-$timestamp.json"
$testReportFile = "$REPORTS_DIR/rbac-test-report-$timestamp.html"

# Set environment variables for tests
$env:TESTING = "true"
$env:RBAC_DEBUG = "true"
$env:PLAYWRIGHT_HEADLESS = if ($Headless) { "true" } else { "false" }

# Determine which tests to run
$testFiles = @()

switch ($TestType.ToLower()) {
    "auth" {
        $testFiles = @("tests/rbac-auth-comprehensive.spec.js")
        Write-Host "🎯 Running authentication tests only" -ForegroundColor Cyan
    }
    "permissions" {
        $testFiles = @("tests/rbac-permissions.spec.js")
        Write-Host "🎯 Running permission tests only" -ForegroundColor Cyan
    }
    "api" {
        $testFiles = @("tests/rbac-api.spec.js")
        Write-Host "🎯 Running API tests only" -ForegroundColor Cyan
    }
    "all" {
        $testFiles = @("tests/rbac-auth-comprehensive.spec.js")
        Write-Host "🎯 Running all RBAC tests" -ForegroundColor Cyan
    }
    default {
        Write-Host "❌ Invalid test type: $TestType" -ForegroundColor Red
        Write-Host "   Valid options: auth, permissions, api, all" -ForegroundColor Yellow
        exit 1
    }
}

# Run tests
$testResults = @()
$totalTests = 0
$passedTests = 0
$failedTests = 0

foreach ($testFile in $testFiles) {
    if (Test-Path $testFile) {
        Write-Host "`n📝 Running tests from: $testFile" -ForegroundColor Cyan
        
        try {
            # Run Playwright tests
            $testOutput = npx playwright test $testFile --reporter=json --timeout=$TEST_TIMEOUT 2>&1
            
            # Parse test results
            $testResult = @{
                file = $testFile
                timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                output = $testOutput
                success = $LASTEXITCODE -eq 0
            }
            
            $testResults += $testResult
            
            if ($testResult.success) {
                Write-Host "✅ Tests passed for: $testFile" -ForegroundColor Green
                $passedTests++
            } else {
                Write-Host "❌ Tests failed for: $testFile" -ForegroundColor Red
                $failedTests++
            }
            
            $totalTests++
            
        } catch {
            Write-Host "❌ Error running tests for: $testFile" -ForegroundColor Red
            Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
            
            $testResults += @{
                file = $testFile
                timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                output = $_.Exception.Message
                success = $false
            }
            
            $failedTests++
            $totalTests++
        }
    } else {
        Write-Host "⚠️  Test file not found: $testFile" -ForegroundColor Yellow
    }
}

# Save test results
$testResults | ConvertTo-Json -Depth 10 | Out-File -FilePath $testResultsFile -Encoding UTF8

# Generate test report
if ($GenerateReport) {
    Write-Host "`n📊 Generating test report..." -ForegroundColor Yellow
    
    $reportHtml = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RBAC Test Report - $timestamp</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card.total { background: #e3f2fd; color: #1976d2; }
        .summary-card.passed { background: #e8f5e8; color: #2e7d32; }
        .summary-card.failed { background: #ffebee; color: #c62828; }
        .summary-value { font-size: 2em; font-weight: bold; margin-bottom: 10px; }
        .test-results { margin-top: 30px; }
        .test-result { margin-bottom: 20px; padding: 15px; border-radius: 8px; border-left: 4px solid; }
        .test-result.success { background: #f1f8e9; border-left-color: #4caf50; }
        .test-result.failure { background: #ffebee; border-left-color: #f44336; }
        .test-file { font-weight: bold; margin-bottom: 10px; }
        .test-timestamp { color: #666; font-size: 0.9em; margin-bottom: 10px; }
        .test-output { background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
        .success-rate { font-size: 1.5em; font-weight: bold; color: #2e7d32; }
        .failure-rate { font-size: 1.5em; font-weight: bold; color: #c62828; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 RBAC Authentication System Test Report</h1>
            <p>Generated on: $timestamp</p>
        </div>
        
        <div class="summary">
            <div class="summary-card total">
                <div class="summary-value">$totalTests</div>
                <div>Total Tests</div>
            </div>
            <div class="summary-card passed">
                <div class="summary-value">$passedTests</div>
                <div>Passed</div>
            </div>
            <div class="summary-card failed">
                <div class="summary-value">$failedTests</div>
                <div>Failed</div>
            </div>
        </div>
        
        <div class="success-rate">
            Success Rate: $(if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 2) } else { 0 })%
        </div>
        
        <div class="test-results">
            <h2>Test Results</h2>
"@

    foreach ($result in $testResults) {
        $statusClass = if ($result.success) { "success" } else { "failure" }
        $statusText = if ($result.success) { "✅ PASSED" } else { "❌ FAILED" }
        
        $reportHtml += @"
            <div class="test-result $statusClass">
                <div class="test-file">$($result.file) - $statusText</div>
                <div class="test-timestamp">$($result.timestamp)</div>
                <div class="test-output">$($result.output)</div>
            </div>
"@
    }

    $reportHtml += @"
        </div>
    </div>
</body>
</html>
"@

    $reportHtml | Out-File -FilePath $testReportFile -Encoding UTF8
    Write-Host "✅ Test report generated: $testReportFile" -ForegroundColor Green
}

# Final summary
Write-Host "`n📊 Test Execution Summary" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red

if ($totalTests -gt 0) {
    $successRate = [math]::Round(($passedTests / $totalTests) * 100, 2)
    Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } elseif ($successRate -ge 60) { "Yellow" } else { "Red" })
}

Write-Host "`n📁 Test Results:" -ForegroundColor Yellow
Write-Host "  Results File: $testResultsFile" -ForegroundColor White
if ($GenerateReport) {
    Write-Host "  Report File: $testReportFile" -ForegroundColor White
}

# Exit with appropriate code
if ($failedTests -gt 0) {
    Write-Host "`n❌ Some tests failed!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n✅ All tests passed!" -ForegroundColor Green
    exit 0
} 