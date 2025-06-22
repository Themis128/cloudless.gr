#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Validates test setup and runs a quick smoke test

.DESCRIPTION
    This script validates that all test files are properly set up and runs a quick
    smoke test to ensure the testing infrastructure is working correctly.

.PARAMETER VerboseOutput
    Enable verbose logging for detailed diagnostics

.EXAMPLE
    ./validate-test-setup.ps1
    ./validate-test-setup.ps1 -VerboseOutput
#>

param(
    [switch]$VerboseOutput
)

function Write-TestLog {
    param([string]$Message, [string]$Level = "INFO")
    $color = switch($Level) {
        "INFO" { "White" }
        "SUCCESS" { "Green" }
        "WARNING" { "Yellow" }
        "ERROR" { "Red" }
    }
    $timestamp = Get-Date -Format "HH:mm:ss.fff"
    Write-Host "[$timestamp][$Level] $Message" -ForegroundColor $color
}

function Write-VerboseLog {
    param([string]$Message)
    if ($VerboseOutput) {
        Write-TestLog "🔍 $Message" "INFO"
    }
}

function Test-FileExists {
    param([string]$FilePath, [string]$Description)
    
    Write-VerboseLog "Checking file: $FilePath"
    
    if (Test-Path $FilePath) {
        Write-TestLog "✓ $Description exists: $FilePath" "SUCCESS"
        
        if ($VerboseOutput) {
            $fileInfo = Get-Item $FilePath
            Write-VerboseLog "  Size: $($fileInfo.Length) bytes"
            Write-VerboseLog "  Modified: $($fileInfo.LastWriteTime)"
        }
        
        return $true
    } else {
        Write-TestLog "✗ $Description missing: $FilePath" "ERROR"
        return $false
    }
}

Write-TestLog "=== TEST SETUP VALIDATION ===" "INFO"
Write-TestLog "Working directory: $(Get-Location)" "INFO"
Write-TestLog "PowerShell version: $($PSVersionTable.PSVersion)" "INFO"
Write-TestLog "Verbose mode: $VerboseOutput" "INFO"

# Check test files
Write-TestLog "Checking test files..." "INFO"
$testFiles = @(
    @{ Path = "playwright/tests/auth/auth-store-complete.spec.ts"; Desc = "Authentication tests" },
    @{ Path = "playwright/tests/routing/page-access-control.spec.ts"; Desc = "Routing tests" },
    @{ Path = "playwright/tests/system/documentation-system.spec.ts"; Desc = "System tests" },
    @{ Path = "playwright/tests/integration/complete-system.spec.ts"; Desc = "Integration tests" },
    @{ Path = "scripts/run-comprehensive-tests.ps1"; Desc = "Test runner script" },
    @{ Path = "COMPREHENSIVE_TEST_DOCUMENTATION.md"; Desc = "Test documentation" }
)

$allFilesExist = $true
foreach ($file in $testFiles) {
    $exists = Test-FileExists $file.Path $file.Desc
    $allFilesExist = $allFilesExist -and $exists
}

if (!$allFilesExist) {
    Write-TestLog "Some test files are missing. Please ensure all files are created." "ERROR"
    exit 1
}

# Check package.json scripts
Write-TestLog "Checking package.json test scripts..." "INFO"
Write-VerboseLog "Reading package.json file..."

try {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    Write-VerboseLog "Successfully parsed package.json"
} catch {
    Write-TestLog "✗ Failed to read package.json: $($_.Exception.Message)" "ERROR"
    exit 1
}

$expectedScripts = @(
    "test:comprehensive",
    "test:auth", 
    "test:routing",
    "test:system",
    "test:integration"
)

foreach ($script in $expectedScripts) {
    if ($packageJson.scripts.$script) {
        Write-TestLog "✓ Script exists: $script" "SUCCESS"
        Write-VerboseLog "  Command: $($packageJson.scripts.$script)"
    } else {
        Write-TestLog "✗ Script missing: $script" "ERROR"
        $allFilesExist = $false
    }
}

# Check if development server is running
Write-TestLog "Checking development server..." "INFO"
Write-VerboseLog "Testing connection to http://localhost:3000"

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method HEAD -TimeoutSec 5 -ErrorAction Stop
    Write-TestLog "✓ Development server is running" "SUCCESS"
    Write-VerboseLog "  Status: $($response.StatusCode) $($response.StatusDescription)"
    Write-VerboseLog "  Headers count: $($response.Headers.Count)"
} catch {
    Write-TestLog "✗ Development server is not running" "WARNING"
    Write-TestLog "Start with: npm run dev" "INFO"
    Write-VerboseLog "  Error: $($_.Exception.Message)"
}

# Check database
Write-TestLog "Checking database connectivity..." "INFO"
Write-VerboseLog "Testing Docker database connection..."

try {
    $dbResult = docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT 1;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-TestLog "✓ Database is accessible" "SUCCESS"
        Write-VerboseLog "  Database connection successful"
        
        if ($VerboseOutput) {
            # Get database info
            $dbVersion = docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT version();" 2>$null
            Write-VerboseLog "  Database version: $($dbVersion -split "`n" | Select-Object -Skip 2 | Select-Object -First 1)"
        }
    } else {
        Write-TestLog "✗ Database is not accessible" "WARNING"
        Write-VerboseLog "  Exit code: $LASTEXITCODE"
    }
} catch {
    Write-TestLog "✗ Could not check database" "WARNING"
    Write-VerboseLog "  Error: $($_.Exception.Message)"
}

# Check admin user exists
Write-TestLog "Checking test admin user..." "INFO"
try {
    $adminCheck = docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT email FROM profiles WHERE role = 'admin' AND email = 'testadmin2@cloudless.gr';" 2>$null
    if ($adminCheck -like "*testadmin2@cloudless.gr*") {
        Write-TestLog "✓ Test admin user exists" "SUCCESS"
    } else {
        Write-TestLog "✗ Test admin user not found" "WARNING"
        Write-TestLog "Create with: curl -X POST http://localhost:3000/api/system/create-admin ..." "INFO"
    }
} catch {
    Write-TestLog "✗ Could not check admin user" "WARNING"
}

# Run a quick smoke test
if ($allFilesExist) {
    Write-TestLog "" "INFO"
    Write-TestLog "=== RUNNING SMOKE TEST ===" "INFO"
    Write-TestLog "Running a quick test to validate setup..." "INFO"
    
    # Test syntax validation
    Write-TestLog "Validating test file syntax..." "INFO"
    
    # Just check if npx playwright test --dry-run works
    try {
        $testFiles[0].Path | ForEach-Object {
            $result = npx playwright test $_ --dry-run 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-TestLog "✓ Test syntax is valid" "SUCCESS"
            } else {
                Write-TestLog "✗ Test syntax errors found" "ERROR"
            }
        }
    } catch {
        Write-TestLog "✗ Could not validate test syntax" "WARNING"
    }
}

Write-TestLog "" "INFO"
Write-TestLog "=== VALIDATION COMPLETE ===" "INFO"

if ($allFilesExist) {
    Write-TestLog "✓ Test setup is ready!" "SUCCESS"
    Write-TestLog "Run tests with: npm run test:comprehensive" "INFO"
    Write-TestLog "Or individual suites: npm run test:auth, test:routing, test:system, test:integration" "INFO"
} else {
    Write-TestLog "✗ Test setup has issues. Please fix the errors above." "ERROR"
    exit 1
}
