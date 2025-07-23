# PowerShell script to run visual tests with real-time progress
# This script runs Playwright tests with visual feedback and browser visibility

param(
    [switch]$Headed = $false,
    [switch]$Slow = $false,
    [switch]$Debug = $false
)

Write-Host "🎯 Starting Visual Test Runner..." -ForegroundColor Green
Write-Host "📋 Configuration:" -ForegroundColor Cyan
Write-Host "  - Headed mode: $Headed" -ForegroundColor White
Write-Host "  - Slow mode: $Slow" -ForegroundColor White
Write-Host "  - Debug mode: $Debug" -ForegroundColor White

# Create test-results directory if it doesn't exist
if (!(Test-Path "test-results")) {
    New-Item -ItemType Directory -Path "test-results" | Out-Null
    Write-Host "📁 Created test-results directory" -ForegroundColor Yellow
}

# Check if Playwright is installed
Write-Host "📋 Checking Playwright installation..." -ForegroundColor Yellow
try {
    $version = npx playwright --version 2>$null
    Write-Host "✅ Playwright version: $version" -ForegroundColor Green
} catch {
    Write-Host "❌ Playwright not found. Installing..." -ForegroundColor Red
    npm install -g @playwright/test
    npx playwright install
}

# Build command based on parameters
$command = "npx playwright test tests/visual-test-runner.spec.js"

if ($Headed) {
    $command += " --headed"
    Write-Host "👁️ Running in headed mode (browser will be visible)" -ForegroundColor Cyan
}

if ($Slow) {
    $command += " --headed --timeout=60000"
    Write-Host "🐌 Running in slow mode (60s timeout)" -ForegroundColor Cyan
}

if ($Debug) {
    $command += " --headed --timeout=0 --debug"
    Write-Host "🐛 Running in debug mode (paused execution)" -ForegroundColor Cyan
}

# Add reporters for better visual feedback
$command += " --reporter=line,html,json"

Write-Host "🚀 Starting Visual Tests..." -ForegroundColor Green
Write-Host "Command: $command" -ForegroundColor Gray

# Run the tests
Write-Host "⏳ Executing tests..." -ForegroundColor Yellow
Invoke-Expression $command

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ All visual tests passed!" -ForegroundColor Green
} else {
    Write-Host "❌ Some visual tests failed. Check the output above." -ForegroundColor Red
}

# Show results
Write-Host "📊 Test Results:" -ForegroundColor Cyan
Write-Host "  - Screenshots: test-results/*.png" -ForegroundColor White
Write-Host "  - HTML Report: playwright-report/index.html" -ForegroundColor White
Write-Host "  - JSON Results: test-results/results.json" -ForegroundColor White

# Open test report if available
if (Test-Path "playwright-report/index.html") {
    Write-Host "📊 Opening test report..." -ForegroundColor Yellow
    Start-Process "playwright-report/index.html"
}

# Show screenshots if any were taken
$screenshots = Get-ChildItem "test-results/*.png" -ErrorAction SilentlyContinue
if ($screenshots) {
    Write-Host "📸 Screenshots taken:" -ForegroundColor Cyan
    foreach ($screenshot in $screenshots) {
        Write-Host "  - $($screenshot.Name)" -ForegroundColor White
    }
}

Write-Host "🏁 Visual test runner completed!" -ForegroundColor Green 