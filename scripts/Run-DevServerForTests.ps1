# Run-DevServerForTests.ps1
# PowerShell script to run the dev server in test mode

# Display colored output
function Write-ColoredOutput {
    param (
        [string]$Message,
        [string]$Color = "White"
    )
    
    Write-Host $Message -ForegroundColor $Color
}

# Main script
Write-ColoredOutput "=== Starting Nuxt Dev Server in Test Mode ===" "Cyan"

# Set the environment variables for testing
$env:NODE_ENV = "test"
$env:NUXT_PUBLIC_TEST_MODE = "true"

# Use the test database
$env:DATABASE_URL = "file:./data/cloudless.test.db"

# Disable real API keys
$env:EMAIL_SERVICE_API_KEY = "test_key"
$env:RECAPTCHA_SECRET_KEY = "test_key"

# Start the dev server
Write-ColoredOutput "Starting Nuxt development server in test mode..." "Yellow"
npm run dev
