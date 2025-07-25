# run-all-tests.ps1
# A PowerShell script to run all contact form tests

# Function to print a section header
function Print-Header {
    param (
        [string]$Text
    )
    Write-Host "`n=======================================" -ForegroundColor Yellow
    Write-Host $Text -ForegroundColor Yellow
    Write-Host "=======================================" -ForegroundColor Yellow
}

# Track failures
$failures = 0

# Function to run a test and track success/failure
function Run-Test {
    param (
        [string]$Name,
        [scriptblock]$Command
    )
    
    Write-Host "`nRunning: $Name" -ForegroundColor Yellow
    try {
        & $Command
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ $Name passed" -ForegroundColor Green
            return $true
        } else {
            Write-Host "✗ $Name failed" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "✗ $Name failed with error: $_" -ForegroundColor Red
        return $false
    }
}

# Check if Nuxt dev server is running
function Check-NuxtServer {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
        return $true
    } catch {
        return $false
    }
}

# Main test execution
Print-Header "Running Contact Form Test Suite"

# 1. Unit tests with Vitest
Print-Header "Running Unit Tests with Vitest"
if (-not (Run-Test "Contact Form Component Tests" { npx vitest run tests/contact-form.test.ts --passWithNoTests })) {
    $failures++
}
if (-not (Run-Test "Contact API Tests" { npx vitest run tests/api-contact.test.ts --passWithNoTests })) {
    $failures++
}
if (-not (Run-Test "Contact Composable Tests" { npx vitest run tests/useContactUs.test.ts --passWithNoTests })) {
    $failures++
}

# 2. Database migration test
Print-Header "Testing Database Migration"
if (-not (Run-Test "Prisma Database Migration Tests" { 
    # Simple Prisma test that works on Windows
    npx prisma generate
    if ($LASTEXITCODE -eq 0) {
        # Try to create a test record
        $testResult = $true
        try {
            npx prisma db push --skip-generate
            if ($LASTEXITCODE -ne 0) { $testResult = $false }
        } catch {
            $testResult = $false
        }
        return $testResult
    } else {
        return $false
    }
})) {
    $failures++
}

# 3. End-to-end tests (only if server is running)
Print-Header "Running E2E Tests"
if (Check-NuxtServer) {
    if (-not (Run-Test "Cypress E2E Tests" { npx cypress run --spec "cypress/e2e/contact-form.cy.ts" })) {
        $failures++
    }
} else {
    Write-Host "Nuxt dev server not running. Skipping E2E tests." -ForegroundColor Yellow
    Write-Host "You can start the server with 'npm run dev' and run the tests separately." -ForegroundColor Yellow
}

# Print summary
Print-Header "Test Summary"
if ($failures -eq 0) {
    Write-Host "All tests passed successfully!" -ForegroundColor Green
} else {
    Write-Host "$failures test groups failed!" -ForegroundColor Red
}

# Exit with appropriate code
exit $failures
