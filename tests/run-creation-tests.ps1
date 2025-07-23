# PowerShell script to run creation flow tests
# This script runs Playwright tests for creating pipelines, models, projects, and LLMs

Write-Host "🚀 Starting Creation Flow Tests..." -ForegroundColor Green

# Check if Playwright is installed
Write-Host "📋 Checking Playwright installation..." -ForegroundColor Yellow
try {
    npx playwright --version
} catch {
    Write-Host "❌ Playwright not found. Installing..." -ForegroundColor Red
    npm install -g @playwright/test
    npx playwright install
}

# Run the focused creation flow tests
Write-Host "🧪 Running Creation Flow Tests..." -ForegroundColor Yellow
Write-Host "Testing: Pipeline, Model, Project, and LLM creation flows" -ForegroundColor Cyan

# Run the focused tests with detailed output
npx playwright test tests/creation-flows-focused.spec.js --reporter=line --timeout=30000

# Check if tests passed
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ All creation flow tests passed!" -ForegroundColor Green
} else {
    Write-Host "❌ Some creation flow tests failed. Check the output above." -ForegroundColor Red
}

# Show test report
Write-Host "📊 Opening test report..." -ForegroundColor Yellow
npx playwright show-report

Write-Host "🏁 Creation flow tests completed!" -ForegroundColor Green 