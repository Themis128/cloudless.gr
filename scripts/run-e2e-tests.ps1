#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Comprehensive E2E Test Runner for Cloudless.gr CI/CD Pipeline

.DESCRIPTION
    This script runs all E2E tests (Cypress, Playwright, and custom tests) in the proper order
    and generates comprehensive reports for the Jenkins pipeline.

.PARAMETER TestSuite
    Specify which test suite to run: 'all', 'cypress', 'playwright', 'custom', 'auth'

.PARAMETER Environment
    Target environment: 'local', 'staging', 'production'

.PARAMETER Headless
    Run tests in headless mode (default: true for CI)

.PARAMETER GenerateReport
    Generate comprehensive HTML report combining all test results

.EXAMPLE
    ./run-e2e-tests.ps1 -TestSuite "all" -Environment "local" -GenerateReport
#>

param(
  [ValidateSet('all', 'cypress', 'playwright', 'custom', 'auth')]
  [string]$TestSuite = 'all',

  [ValidateSet('local', 'staging', 'production')]
  [string]$Environment = 'local',

  [bool]$Headless = $true,

  [switch]$GenerateReport
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

# Configuration
$BaseUrl = switch ($Environment) {
  'local' { 'http://localhost:3000' }
  'staging' { 'https://staging.cloudless.gr' }
  'production' { 'https://cloudless.gr' }
}

$TestResults = @{
  StartTime  = Get-Date
  Cypress    = @{ Status = 'Not Run'; Duration = 0; TestCount = 0; Passed = 0; Failed = 0 }
  Playwright = @{ Status = 'Not Run'; Duration = 0; TestCount = 0; Passed = 0; Failed = 0 }
  Custom     = @{ Status = 'Not Run'; Duration = 0; TestCount = 0; Passed = 0; Failed = 0 }
  Overall    = @{ Status = 'Running'; Duration = 0; TotalTests = 0; TotalPassed = 0; TotalFailed = 0 }
}

function Write-TestHeader {
  param([string]$Title)

  Write-Host ""
  Write-Host "=" * 80 -ForegroundColor Cyan
  Write-Host "  $Title" -ForegroundColor Yellow
  Write-Host "=" * 80 -ForegroundColor Cyan
  Write-Host ""
}

function Wait-ForApplication {
  param([string]$Url, [int]$TimeoutSeconds = 60)

  Write-Host "🔍 Waiting for application to be ready at $Url..." -ForegroundColor Blue

  $timeout = (Get-Date).AddSeconds($TimeoutSeconds)
  $ready = $false

  while ((Get-Date) -lt $timeout -and -not $ready) {
    try {
      $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing
      if ($response.StatusCode -eq 200) {
        $ready = $true
        Write-Host "✅ Application is ready!" -ForegroundColor Green
      }
    }
    catch {
      Write-Host "⏳ Still waiting..." -ForegroundColor Yellow
      Start-Sleep -Seconds 2
    }
  }

  if (-not $ready) {
    Write-Host "❌ Application not ready after $TimeoutSeconds seconds" -ForegroundColor Red
    throw "Application not responding"
  }
}

function Invoke-CypressTests {
  Write-TestHeader "Running Cypress E2E Tests"

  $startTime = Get-Date

  try {
    # Install Cypress if needed
    Write-Host "📦 Installing Cypress..." -ForegroundColor Blue
    & npx cypress install

    # Run Cypress tests
    $cypressArgs = @(
      'cypress', 'run'
      '--browser', 'chrome'
      '--config', "baseUrl=$BaseUrl"
      '--reporter', 'cypress-mochawesome-reporter'
      '--reporter-options', 'reportDir=cypress/results/html,overwrite=false,html=true,json=true'
    )

    if ($Headless) {
      $cypressArgs += '--headless'
    }

    Write-Host "🧪 Running Cypress tests..." -ForegroundColor Blue
    $cypressResult = & npx @cypressArgs

    $TestResults.Cypress.Status = if ($LASTEXITCODE -eq 0) { 'Passed' } else { 'Failed' }
    $TestResults.Cypress.Duration = ((Get-Date) - $startTime).TotalSeconds

    # Parse results if available
    $resultsFile = "cypress/results/html/index.html"
    if (Test-Path $resultsFile) {
      Write-Host "✅ Cypress results saved to $resultsFile" -ForegroundColor Green
    }

    Write-Host "Cypress Tests: $($TestResults.Cypress.Status)" -ForegroundColor $(if ($TestResults.Cypress.Status -eq 'Passed') { 'Green' } else { 'Red' })
  }
  catch {
    $TestResults.Cypress.Status = 'Error'
    $TestResults.Cypress.Duration = ((Get-Date) - $startTime).TotalSeconds
    Write-Host "❌ Cypress tests failed: $($_.Exception.Message)" -ForegroundColor Red
  }
}

function Invoke-PlaywrightTests {
  Write-TestHeader "Running Playwright E2E Tests"

  $startTime = Get-Date

  try {
    # Install Playwright browsers
    Write-Host "📦 Installing Playwright browsers..." -ForegroundColor Blue
    & npx playwright install --with-deps chromium firefox webkit

    # Set environment variables
    $env:PLAYWRIGHT_baseURL = $BaseUrl
    $env:CI = 'true'

    # Run auth tests first (critical)
    Write-Host "🔐 Running authentication tests..." -ForegroundColor Blue
    & npx playwright test --project=auth-tests --reporter=html, line, junit

    # Run main application tests
    Write-Host "🏗️ Running main application tests..." -ForegroundColor Blue
    & npx playwright test --project=chromium --reporter=html, line, junit

    # Run cross-browser tests (non-critical)
    Write-Host "🌐 Running cross-browser tests..." -ForegroundColor Yellow
    & npx playwright test --project=firefox, webkit --reporter=html, line, junit

    # Run mobile tests
    Write-Host "📱 Running mobile tests..." -ForegroundColor Blue
    & npx playwright test --project=mobile-chrome --reporter=html, line, junit

    $TestResults.Playwright.Status = if ($LASTEXITCODE -eq 0) { 'Passed' } else { 'Failed' }
    $TestResults.Playwright.Duration = ((Get-Date) - $startTime).TotalSeconds

    # Parse results
    $resultsFiles = Get-ChildItem -Path "playwright/results" -Filter "*.xml" -Recurse
    foreach ($file in $resultsFiles) {
      Write-Host "✅ Playwright results: $($file.FullName)" -ForegroundColor Green
    }

    Write-Host "Playwright Tests: $($TestResults.Playwright.Status)" -ForegroundColor $(if ($TestResults.Playwright.Status -eq 'Passed') { 'Green' } else { 'Red' })
  }
  catch {
    $TestResults.Playwright.Status = 'Error'
    $TestResults.Playwright.Duration = ((Get-Date) - $startTime).TotalSeconds
    Write-Host "❌ Playwright tests failed: $($_.Exception.Message)" -ForegroundColor Red
  }
}

function Invoke-CustomTests {
  Write-TestHeader "Running Custom Integration Tests"

  $startTime = Get-Date

  try {
    $customTests = @(
      @{ Name = 'Final Login Test'; File = 'test-final-login.mjs' }
      @{ Name = 'Final Registration Test'; File = 'test-final-registration.mjs' }
      @{ Name = 'Robust Auth Test'; File = 'test-robust-auth.mjs' }
    )

    $customPassed = 0
    $customFailed = 0

    foreach ($test in $customTests) {
      Write-Host "🚀 Running $($test.Name)..." -ForegroundColor Blue

      try {
        & node $test.File
        if ($LASTEXITCODE -eq 0) {
          Write-Host "✅ $($test.Name) passed" -ForegroundColor Green
          $customPassed++
        }
        else {
          Write-Host "❌ $($test.Name) failed" -ForegroundColor Red
          $customFailed++
        }
      }
      catch {
        Write-Host "❌ $($test.Name) error: $($_.Exception.Message)" -ForegroundColor Red
        $customFailed++
      }
    }

    $TestResults.Custom.Status = if ($customFailed -eq 0) { 'Passed' } else { 'Failed' }
    $TestResults.Custom.Duration = ((Get-Date) - $startTime).TotalSeconds
    $TestResults.Custom.TestCount = $customTests.Count
    $TestResults.Custom.Passed = $customPassed
    $TestResults.Custom.Failed = $customFailed

    Write-Host "Custom Tests: $($TestResults.Custom.Status) ($customPassed/$($customTests.Count) passed)" -ForegroundColor $(if ($TestResults.Custom.Status -eq 'Passed') { 'Green' } else { 'Red' })
  }
  catch {
    $TestResults.Custom.Status = 'Error'
    $TestResults.Custom.Duration = ((Get-Date) - $startTime).TotalSeconds
    Write-Host "❌ Custom tests failed: $($_.Exception.Message)" -ForegroundColor Red
  }
}

function New-TestReport {
  Write-TestHeader "Generating Comprehensive Test Report"

  $TestResults.Overall.Duration = ((Get-Date) - $TestResults.StartTime).TotalSeconds
  $TestResults.Overall.TotalTests = $TestResults.Cypress.TestCount + $TestResults.Playwright.TestCount + $TestResults.Custom.TestCount
  $TestResults.Overall.TotalPassed = $TestResults.Cypress.Passed + $TestResults.Playwright.Passed + $TestResults.Custom.Passed
  $TestResults.Overall.TotalFailed = $TestResults.Cypress.Failed + $TestResults.Playwright.Failed + $TestResults.Custom.Failed

  # Determine overall status
  $failedSuites = @($TestResults.Cypress, $TestResults.Playwright, $TestResults.Custom) | Where-Object { $_.Status -eq 'Failed' -or $_.Status -eq 'Error' }
  $TestResults.Overall.Status = if ($failedSuites.Count -eq 0) { 'Passed' } else { 'Failed' }

  # Create HTML report
  $reportHtml = @"
<!DOCTYPE html>
<html>
<head>
    <title>Cloudless.gr E2E Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); flex: 1; }
        .passed { border-left: 4px solid #4CAF50; }
        .failed { border-left: 4px solid #f44336; }
        .error { border-left: 4px solid #ff9800; }
        .metric { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .suite { margin: 20px 0; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #666; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Cloudless.gr E2E Test Report</h1>
        <p>Environment: $Environment | Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
    </div>

    <div class="summary">
        <div class="card $($TestResults.Overall.Status.ToLower())">
            <h3>Overall Status</h3>
            <div class="metric">$($TestResults.Overall.Status)</div>
            <p>Duration: $([math]::Round($TestResults.Overall.Duration, 2))s</p>
        </div>
        <div class="card">
            <h3>Total Tests</h3>
            <div class="metric">$($TestResults.Overall.TotalTests)</div>
            <p>Passed: $($TestResults.Overall.TotalPassed) | Failed: $($TestResults.Overall.TotalFailed)</p>
        </div>
    </div>

    <div class="suite $($TestResults.Cypress.Status.ToLower())">
        <h3>🧪 Cypress E2E Tests</h3>
        <p><strong>Status:</strong> $($TestResults.Cypress.Status)</p>
        <p><strong>Duration:</strong> $([math]::Round($TestResults.Cypress.Duration, 2))s</p>
        <p><strong>Tests:</strong> $($TestResults.Cypress.TestCount) (Passed: $($TestResults.Cypress.Passed), Failed: $($TestResults.Cypress.Failed))</p>
    </div>

    <div class="suite $($TestResults.Playwright.Status.ToLower())">
        <h3>🎭 Playwright E2E Tests</h3>
        <p><strong>Status:</strong> $($TestResults.Playwright.Status)</p>
        <p><strong>Duration:</strong> $([math]::Round($TestResults.Playwright.Duration, 2))s</p>
        <p><strong>Tests:</strong> $($TestResults.Playwright.TestCount) (Passed: $($TestResults.Playwright.Passed), Failed: $($TestResults.Playwright.Failed))</p>
    </div>

    <div class="suite $($TestResults.Custom.Status.ToLower())">
        <h3>🔧 Custom Integration Tests</h3>
        <p><strong>Status:</strong> $($TestResults.Custom.Status)</p>
        <p><strong>Duration:</strong> $([math]::Round($TestResults.Custom.Duration, 2))s</p>
        <p><strong>Tests:</strong> $($TestResults.Custom.TestCount) (Passed: $($TestResults.Custom.Passed), Failed: $($TestResults.Custom.Failed))</p>
    </div>

    <div class="footer">
        <p>Generated by Cloudless.gr CI/CD Pipeline | Build #${env:BUILD_NUMBER}</p>
    </div>
</body>
</html>
"@

  $reportPath = "e2e-test-report.html"
  $reportHtml | Out-File -FilePath $reportPath -Encoding UTF8

  Write-Host "📊 Test report generated: $reportPath" -ForegroundColor Green

  # Output summary to console
  Write-Host ""
  Write-Host "📊 TEST SUMMARY" -ForegroundColor Cyan
  Write-Host "===============" -ForegroundColor Cyan
  Write-Host "Overall Status: $($TestResults.Overall.Status)" -ForegroundColor $(if ($TestResults.Overall.Status -eq 'Passed') { 'Green' } else { 'Red' })
  Write-Host "Total Duration: $([math]::Round($TestResults.Overall.Duration, 2))s"
  Write-Host "Cypress: $($TestResults.Cypress.Status) ($([math]::Round($TestResults.Cypress.Duration, 2))s)"
  Write-Host "Playwright: $($TestResults.Playwright.Status) ($([math]::Round($TestResults.Playwright.Duration, 2))s)"
  Write-Host "Custom: $($TestResults.Custom.Status) ($([math]::Round($TestResults.Custom.Duration, 2))s)"
  Write-Host ""
}

# Main execution
try {
  Write-TestHeader "Cloudless.gr E2E Test Suite"
  Write-Host "Test Suite: $TestSuite | Environment: $Environment | Headless: $Headless" -ForegroundColor Blue

  # Wait for application to be ready
  if ($Environment -eq 'local') {
    Wait-ForApplication -Url $BaseUrl
  }

  # Run test suites based on selection
  switch ($TestSuite) {
    'all' {
      Invoke-CypressTests
      Invoke-PlaywrightTests
      Invoke-CustomTests
    }
    'cypress' { Invoke-CypressTests }
    'playwright' { Invoke-PlaywrightTests }
    'custom' { Invoke-CustomTests }
    'auth' {
      # Run only auth-related tests
      Invoke-PlaywrightTests  # Includes auth-tests project
      Invoke-CustomTests      # Includes auth-specific custom tests
    }
  }

  # Generate report if requested
  if ($GenerateReport) {
    New-TestReport
  }

  # Exit with appropriate code
  if ($TestResults.Overall.Status -eq 'Passed') {
    Write-Host "🎉 All tests passed!" -ForegroundColor Green
    exit 0
  }
  else {
    Write-Host "❌ Some tests failed!" -ForegroundColor Red
    exit 1
  }
}
catch {
  Write-Host "💥 Test execution failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
