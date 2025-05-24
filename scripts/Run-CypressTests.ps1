# Run-CypressTests.ps1
# PowerShell script to run Cypress tests for the contact form

param (
    [string]$Mode = "run"
)

# Check if Nuxt dev server is running
function Check-NuxtServer {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
        return $true
    } catch {
        return $false
    }
}

# Display colored output
function Write-ColoredOutput {
    param (
        [string]$Message,
        [string]$Color = "White"
    )
    
    Write-Host $Message -ForegroundColor $Color
}

# Main script
Write-ColoredOutput "=== Cypress Contact Form Test Runner ===" "Cyan"

# Check if dev server is running
if (-not (Check-NuxtServer)) {
    Write-ColoredOutput "Starting Nuxt development server..." "Yellow"
    
    # Start the dev server in a separate window
    $rootPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    
    # Start the Nuxt development server in a new window with higher priority
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d $rootPath && npm run dev" -PassThru -WindowStyle Minimized
      # Wait for server to start
    Write-ColoredOutput "Waiting for server to start..." "Yellow"
    $serverStarted = $false
    $attempts = 0
    
    while (-not $serverStarted -and $attempts -lt 60) {
        if (Check-NuxtServer) {
            $serverStarted = $true
        } else {
            Start-Sleep -Seconds 2
            $attempts++
            Write-Host "." -NoNewline
        }
    }
    
    if (-not $serverStarted) {
        Write-ColoredOutput "`nFailed to start development server. Please start it manually with 'npm run dev'" "Red"
        exit 1
    }
    
    Write-ColoredOutput "`nServer started successfully!" "Green"
}

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
