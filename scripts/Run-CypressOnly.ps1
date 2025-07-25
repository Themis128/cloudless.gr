# Run-CypressOnly.ps1
# PowerShell script to run Cypress tests for the contact form (no server management)

param (
    [string]$Mode = "run"
)

# Display colored output
function Write-ColoredOutput {
    param (
        [string]$Message,
        [string]$Color = "White"
    )
    
    Write-Host $Message -ForegroundColor $Color
}

# Main script
Write-ColoredOutput "=== Cypress Contact Form Tests (No Server Management) ===" "Cyan"

# Run Cypress tests
Write-ColoredOutput "Running Cypress tests for the contact form..." "Cyan"

# Choose mode based on parameter
if ($Mode -eq "open") {
    # Interactive mode
    Write-ColoredOutput "Starting Cypress in interactive mode..." "Yellow"
    npx cypress open --e2e
} else {
    # Headless mode
    Write-ColoredOutput "Running Cypress tests in headless mode..." "Yellow"
    npx cypress run --spec "cypress/e2e/contact-form.cy.ts"
    
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-ColoredOutput "All tests passed successfully!" "Green"
    } else {
        Write-ColoredOutput "Some tests failed. Check the output above for details." "Red"
    }
}

Write-ColoredOutput "=== Test run complete ===" "Cyan"
