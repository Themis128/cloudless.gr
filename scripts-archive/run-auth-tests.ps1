# Simple Authentication Test Runner
# Uses the AuthTestModule for consistent testing

param(
    [string]$ServerUrl = "http://localhost:3000",
    [string]$Environment = "development",
    [switch]$GenerateReport,
    [string]$ReportPath = "auth-test-report.json"
)

# Import the authentication testing module
Import-Module "$PSScriptRoot\AuthTestModule.psm1" -Force

try {
    # Create test suite instance
    $testSuite = [AuthTestSuite]::new($ServerUrl, $Environment)
    
    # Run the complete test suite
    if ($GenerateReport) {
        $testSuite.GenerateReport($ReportPath)
    } else {
        $results = $testSuite.RunFullTestSuite()
        
        # Output final summary
        Write-Host "`n=== FINAL RESULTS ===" -ForegroundColor Cyan
        Write-Host "Total Tests: $($results.TotalTests)" -ForegroundColor White
        Write-Host "Passed: $($results.PassedTests)" -ForegroundColor Green
        Write-Host "Failed: $($results.FailedTests)" -ForegroundColor $(if ($results.FailedTests -eq 0) { "Green" } else { "Red" })
        Write-Host "Success Rate: $($results.SuccessRate)%" -ForegroundColor $(if ($results.SuccessRate -ge 90) { "Green" } elseif ($results.SuccessRate -ge 70) { "Yellow" } else { "Red" })
        Write-Host "Duration: $($results.Duration.ToString('F2')) seconds" -ForegroundColor White
        
        # Exit with appropriate code for CI/CD
        $exitCode = if ($results.SuccessRate -ge 90) { 0 } else { 1 }
        exit $exitCode
    }
} catch {
    Write-Host "Test runner failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
