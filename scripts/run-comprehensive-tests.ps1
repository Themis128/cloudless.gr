#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Comprehensive test runner for authentication, routing, and system tests

.DESCRIPTION
    This script runs different test suites for the cloudless.gr application:
    - Authentication functions (register, login, reset)
    - Page access control and routing
    - Documentation and system integrity
    - Complete integration tests

.PARAMETER TestSuite
    Which test suite to run: auth, routing, system, integration, all

.PARAMETER Environment
    Environment to test against: local, staging, production

.PARAMETER Headless
    Run tests in headless mode

.PARAMETER GenerateReport
    Generate HTML test report

.PARAMETER Verbose
    Enable verbose logging

.EXAMPLE
    ./run-comprehensive-tests.ps1 -TestSuite auth -Environment local
    ./run-comprehensive-tests.ps1 -TestSuite all -Environment local -GenerateReport
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("auth", "routing", "system", "integration", "all")]
    [string]$TestSuite,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("local", "staging", "production")]
    [string]$Environment = "local",
    
    [Parameter(Mandatory=$false)]
    [switch]$Headless = $false,
      [Parameter(Mandatory=$false)]
    [switch]$GenerateReport = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$VerboseOutput = $false
)

# Configuration
$Config = @{
    local = @{
        baseUrl = "http://localhost:3000"
        dbCheck = $true
    }
    staging = @{
        baseUrl = "https://staging.cloudless.gr"
        dbCheck = $false
    }
    production = @{
        baseUrl = "https://cloudless.gr"
        dbCheck = $false
    }
}

$currentConfig = $Config[$Environment]
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$reportDir = "playwright/test-results/comprehensive-$timestamp"

# Test suite definitions
$TestSuites = @{
    auth = @{
        name = "Authentication Functions"
        files = @(
            "playwright/tests/auth/auth-store-complete.spec.ts"
        )
        description = "Tests register, login, reset, and auth state management"
    }
    routing = @{
        name = "Page Access Control & Routing" 
        files = @(
            "playwright/tests/routing/page-access-control.spec.ts"
        )
        description = "Tests public/private page access, redirects, and navigation"
    }
    system = @{
        name = "Documentation & System Integrity"
        files = @(
            "playwright/tests/system/documentation-system.spec.ts"
        )
        description = "Tests documentation, API health, database connectivity, performance"
    }
    integration = @{
        name = "Complete Integration Tests"
        files = @(
            "playwright/tests/integration/complete-system.spec.ts"
        )
        description = "End-to-end workflows and cross-browser compatibility"
    }
    all = @{
        name = "All Test Suites"
        files = @(
            "playwright/tests/auth/auth-store-complete.spec.ts",
            "playwright/tests/routing/page-access-control.spec.ts", 
            "playwright/tests/system/documentation-system.spec.ts",
            "playwright/tests/integration/complete-system.spec.ts"
        )
        description = "Complete comprehensive test suite"
    }
}

function Write-TestLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $color = switch($Level) {
        "INFO" { "White" }
        "SUCCESS" { "Green" }
        "WARNING" { "Yellow" }
        "ERROR" { "Red" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

function Test-Prerequisites {
    Write-TestLog "Checking prerequisites..." "INFO"
    
    # Check if development server is running (for local environment)
    if ($Environment -eq "local") {
        try {
            $response = Invoke-WebRequest -Uri "$($currentConfig.baseUrl)" -Method HEAD -TimeoutSec 5 -ErrorAction Stop
            Write-TestLog "✓ Development server is running" "SUCCESS"
        }
        catch {
            Write-TestLog "✗ Development server is not running. Please start with 'npm run dev'" "ERROR"
            return $false
        }
        
        # Check database connectivity
        if ($currentConfig.dbCheck) {
            try {
                $dbResult = docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT 1;" 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-TestLog "✓ Database is accessible" "SUCCESS"
                } else {
                    Write-TestLog "✗ Database is not accessible. Please check Supabase containers" "WARNING"
                }
            }
            catch {
                Write-TestLog "✗ Could not check database connectivity" "WARNING"
            }
        }
    }
    
    # Check if Playwright is installed
    if (!(Test-Path "node_modules/@playwright/test")) {
        Write-TestLog "✗ Playwright is not installed. Run 'npm install'" "ERROR"
        return $false
    }
    
    Write-TestLog "✓ Prerequisites check completed" "SUCCESS"
    return $true
}

function Start-TestSuite {
    param([string]$SuiteName)
    
    $suite = $TestSuites[$SuiteName]
      Write-TestLog "Starting test suite: $($suite.name)" "INFO"
    Write-TestLog "Description: $($suite.description)" "INFO"
    Write-TestLog "Environment: $Environment ($($currentConfig.baseUrl))" "INFO"
    Write-TestLog "Files to test: $($suite.files.Count)" "INFO"
    
    if ($VerboseOutput) {
        Write-TestLog "Test files:" "INFO"
        $suite.files | ForEach-Object { Write-TestLog "  - $_" "INFO" }
        Write-TestLog "Configuration details:" "INFO"
        Write-TestLog "  - Base URL: $($currentConfig.baseUrl)" "INFO"
        Write-TestLog "  - Database check: $($currentConfig.dbCheck)" "INFO"
        Write-TestLog "  - Headless mode: $Headless" "INFO"
        Write-TestLog "  - Generate report: $GenerateReport" "INFO"
        Write-TestLog "  - Report directory: $reportDir" "INFO"
    }
    
    # Build Playwright command
    $playwrightArgs = @()
    
    # Add test files
    $suite.files | ForEach-Object { $playwrightArgs += $_ }
    
    # Add environment configuration
    $playwrightArgs += "--grep", "@$Environment"
    
    # Add headless mode
    if ($Headless) {
        $playwrightArgs += "--headed", "false"
    } else {
        $playwrightArgs += "--headed", "true"
    }
    
    # Add verbose output if requested
    if ($VerboseOutput) {
        $playwrightArgs += "--verbose"
    }
    
    # Add reporter
    if ($GenerateReport) {
        $playwrightArgs += "--reporter", "html"
        $playwrightArgs += "--output-dir", $reportDir
    }
      # Add base URL
    $playwrightArgs += "--use-base-url", $currentConfig.baseUrl
    
    # Set environment variables
    $env:PLAYWRIGHT_BASE_URL = $currentConfig.baseUrl
    $env:TEST_ENVIRONMENT = $Environment
    
    if ($VerboseOutput) {
        Write-TestLog "Environment variables set:" "INFO"
        Write-TestLog "  - PLAYWRIGHT_BASE_URL: $env:PLAYWRIGHT_BASE_URL" "INFO"
        Write-TestLog "  - TEST_ENVIRONMENT: $env:TEST_ENVIRONMENT" "INFO"
    }
    
    Write-TestLog "Running Playwright tests..." "INFO"
    Write-TestLog "Command: npx playwright test $($playwrightArgs -join ' ')" "INFO"
    
    if ($VerboseOutput) {
        Write-TestLog "Full command line arguments:" "INFO"
        $playwrightArgs | ForEach-Object { Write-TestLog "  - $_" "INFO" }
    }
    
    # Run the tests
    $startTime = Get-Date
    if ($VerboseOutput) {
        Write-TestLog "Test execution started at: $($startTime.ToString('yyyy-MM-dd HH:mm:ss'))" "INFO"
    }
    
    & npx playwright test @playwrightArgs
    $testResult = $LASTEXITCODE
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    # Report results
    if ($testResult -eq 0) {
        Write-TestLog "✓ Test suite '$($suite.name)' completed successfully" "SUCCESS"
        Write-TestLog "Duration: $($duration.ToString('mm\:ss'))" "SUCCESS"
    } else {
        Write-TestLog "✗ Test suite '$($suite.name)' failed with exit code $testResult" "ERROR"
        Write-TestLog "Duration: $($duration.ToString('mm\:ss'))" "ERROR"
    }
    
    if ($VerboseOutput) {
        Write-TestLog "Test execution ended at: $($endTime.ToString('yyyy-MM-dd HH:mm:ss'))" "INFO"
        Write-TestLog "Exit code: $testResult" "INFO"
    }
    
    return $testResult
}

function Show-TestReport {
    if ($GenerateReport -and (Test-Path "$reportDir/index.html")) {
        Write-TestLog "Test report generated: $reportDir/index.html" "SUCCESS"
        Write-TestLog "Opening test report..." "INFO"
        Start-Process "$reportDir/index.html"
    }
}

function Show-TestSummary {
    param([hashtable]$Results)
    
    Write-TestLog "" "INFO"
    Write-TestLog "=== TEST SUMMARY ===" "INFO"
    Write-TestLog "Environment: $Environment" "INFO"
    Write-TestLog "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "INFO"
    Write-TestLog "" "INFO"
    
    $totalTests = $Results.Count
    $passedTests = ($Results.GetEnumerator() | Where-Object { $_.Value -eq 0 }).Count
    $failedTests = $totalTests - $passedTests
    
    $Results.GetEnumerator() | ForEach-Object {
        $status = if ($_.Value -eq 0) { "✓ PASSED" } else { "✗ FAILED" }
        $color = if ($_.Value -eq 0) { "SUCCESS" } else { "ERROR" }
        Write-TestLog "$status - $($_.Key)" $color
    }
    
    Write-TestLog "" "INFO"
    Write-TestLog "Total: $totalTests | Passed: $passedTests | Failed: $failedTests" "INFO"
    
    if ($failedTests -eq 0) {
        Write-TestLog "🎉 All tests passed!" "SUCCESS"
    } else {
        Write-TestLog "⚠️ $failedTests test suite(s) failed" "ERROR"
    }
}

# Main execution
try {
    Write-TestLog "=== COMPREHENSIVE TEST RUNNER ===" "INFO"
    Write-TestLog "Starting comprehensive test execution for cloudless.gr" "INFO"
    
    # Check prerequisites
    if (!(Test-Prerequisites)) {
        exit 1
    }
    
    # Run tests
    $results = @{}
    
    if ($TestSuite -eq "all") {
        # Run all test suites
        @("auth", "routing", "system", "integration") | ForEach-Object {
            $results[$TestSuites[$_].name] = Start-TestSuite $_
        }
    } else {
        # Run specific test suite
        $results[$TestSuites[$TestSuite].name] = Start-TestSuite $TestSuite
    }
    
    # Show summary
    Show-TestSummary $results
    
    # Show report
    Show-TestReport
    
    # Exit with appropriate code
    $overallResult = ($results.Values | Measure-Object -Maximum).Maximum
    exit $overallResult
    
} catch {
    Write-TestLog "Unexpected error occurred: $($_.Exception.Message)" "ERROR"
    Write-TestLog "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    exit 1
}
