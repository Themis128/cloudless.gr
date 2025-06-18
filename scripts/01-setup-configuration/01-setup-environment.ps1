# Environment Setup and Validation Script
# This script sets up and validates the development environment
# for the Nuxt/Supabase project
#
# Features:
#   • Environment variable setup and validation
#   • Docker environment preparation
#   • Directory structure creation
#   • File permission fixes
#   • Development tools verification
#
# Usage Examples:
#   .\scripts\01-setup-environment.ps1              # Full setup
#   .\scripts\01-setup-environment.ps1 -CheckOnly  # Validation only
#   .\scripts\01-setup-environment.ps1 -Force      # Skip prompts

param(
    [switch]$CheckOnly,
    [switch]$Force,
    [switch]$CreateMissing
)

Write-Host "🛠️  ENVIRONMENT SETUP AND VALIDATION" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Configuration
$requiredDirectories = @(
    "docker",
    "docker/supabase",
    "docker/volumes",
    "scripts",
    "docker/dev"
)

$requiredFiles = @(
    "docker/docker-compose.yml",
    "docker/.env",
    "package.json",
    "nuxt.config.ts"
)

$envTemplate = @{
    "SUPABASE_URL" = "http://localhost:54321"
    "SUPABASE_ANON_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    "SUPABASE_SERVICE_ROLE_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    "DB_PASSWORD" = "your-super-secret-and-long-postgres-password"
    "JWT_SECRET" = "your-super-secret-jwt-token-with-at-least-32-characters-long"
    "POSTGRES_PASSWORD" = "your-super-secret-and-long-postgres-password"
    "STUDIO_PORT" = "54323"
    "API_PORT" = "54321"
    "DB_PORT" = "54322"
}

# Function to check system requirements
function Test-SystemRequirements {
    Write-Host ""
    Write-Host "🔍 CHECKING SYSTEM REQUIREMENTS..." -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    $requirements = @()
    
    # Check Docker
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            Write-Host "  ✓ Docker: $dockerVersion" -ForegroundColor Green
            $requirements += @{Name="Docker"; Status="OK"; Version=$dockerVersion}
        } else {
            throw "Docker not found"
        }
    }
    catch {
        Write-Host "  ❌ Docker: Not found or not running" -ForegroundColor Red
        $requirements += @{Name="Docker"; Status="MISSING"; Version="N/A"}
    }
    
    # Check Docker Compose
    try {
        $composeVersion = docker-compose --version 2>$null
        if ($composeVersion) {
            Write-Host "  ✓ Docker Compose: $composeVersion" -ForegroundColor Green
            $requirements += @{Name="Docker Compose"; Status="OK"; Version=$composeVersion}
        } else {
            throw "Docker Compose not found"
        }
    }
    catch {
        Write-Host "  ❌ Docker Compose: Not found" -ForegroundColor Red
        $requirements += @{Name="Docker Compose"; Status="MISSING"; Version="N/A"}
    }
    
    # Check Node.js
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Green
            $requirements += @{Name="Node.js"; Status="OK"; Version=$nodeVersion}
        } else {
            throw "Node.js not found"
        }
    }
    catch {
        Write-Host "  ⚠️  Node.js: Not found (optional for Docker setup)" -ForegroundColor Yellow
        $requirements += @{Name="Node.js"; Status="OPTIONAL"; Version="N/A"}
    }
    
    # Check NPM
    try {
        $npmVersion = npm --version 2>$null
        if ($npmVersion) {
            Write-Host "  ✓ NPM: $npmVersion" -ForegroundColor Green
            $requirements += @{Name="NPM"; Status="OK"; Version=$npmVersion}
        } else {
            throw "NPM not found"
        }
    }
    catch {
        Write-Host "  ⚠️  NPM: Not found (optional for Docker setup)" -ForegroundColor Yellow
        $requirements += @{Name="NPM"; Status="OPTIONAL"; Version="N/A"}
    }
    
    return $requirements
}

# Function to check and create directories
function Initialize-DirectoryStructure {
    Write-Host ""
    Write-Host "📁 CHECKING DIRECTORY STRUCTURE..." -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    foreach ($dir in $requiredDirectories) {
        if (Test-Path $dir) {
            Write-Host "  ✓ Directory exists: $dir" -ForegroundColor Green
        } else {
            if ($CreateMissing) {
                try {
                    New-Item -ItemType Directory -Path $dir -Force | Out-Null
                    Write-Host "  ✓ Created directory: $dir" -ForegroundColor Green
                }
                catch {
                    Write-Host "  ❌ Failed to create directory: $dir" -ForegroundColor Red
                }
            } else {
                Write-Host "  ⚠️  Missing directory: $dir" -ForegroundColor Yellow
            }
        }
    }
}

# Function to check required files
function Test-RequiredFiles {
    Write-Host ""
    Write-Host "📄 CHECKING REQUIRED FILES..." -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    foreach ($file in $requiredFiles) {
        if (Test-Path $file) {
            $size = (Get-Item $file).Length
            if ($size -gt 0) {
                Write-Host "  ✓ File exists and has content: $file ($size bytes)" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  File exists but is empty: $file" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  ❌ Missing file: $file" -ForegroundColor Red
        }
    }
}

# Function to setup environment variables
function Initialize-EnvironmentVariables {
    Write-Host ""
    Write-Host "🔧 SETTING UP ENVIRONMENT VARIABLES..." -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    $envFile = "docker/.env"
    $envExampleFile = "docker/.env.example"
    
    # Check if .env exists
    if (Test-Path $envFile) {
        Write-Host "  ✓ Environment file exists: $envFile" -ForegroundColor Green
        
        # Validate environment variables
        $envContent = Get-Content $envFile -Raw
        foreach ($key in $envTemplate.Keys) {
            if ($envContent -match "$key=") {
                Write-Host "    ✓ $key is set" -ForegroundColor Green
            } else {
                Write-Host "    ⚠️  $key is missing" -ForegroundColor Yellow
                if ($CreateMissing) {
                    Add-Content $envFile "`n$key=$($envTemplate[$key])"
                    Write-Host "    ✓ Added $key to .env" -ForegroundColor Green
                }
            }
        }
    } else {
        if ($CreateMissing) {
            Write-Host "  🔧 Creating .env file from template..." -ForegroundColor Cyan
            
            $envContent = "# Supabase Development Environment Configuration`n"
            $envContent += "# Generated by setup script on $(Get-Date)`n`n"
            
            foreach ($key in $envTemplate.Keys) {
                $envContent += "$key=$($envTemplate[$key])`n"
            }
            
            Set-Content $envFile $envContent
            Write-Host "  ✓ Created .env file with default values" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Missing .env file" -ForegroundColor Red
        }
    }
    
    # Create .env.example if it doesn't exist
    if (-not (Test-Path $envExampleFile) -and $CreateMissing) {
        $exampleContent = "# Supabase Development Environment Configuration Example`n"
        $exampleContent += "# Copy this file to .env and update the values`n`n"
        
        foreach ($key in $envTemplate.Keys) {
            $exampleContent += "$key=your-$($key.ToLower().Replace('_', '-'))-here`n"
        }
        
        Set-Content $envExampleFile $exampleContent
        Write-Host "  ✓ Created .env.example file" -ForegroundColor Green
    }
}

# Function to test Docker connectivity
function Test-DockerConnectivity {
    Write-Host ""
    Write-Host "🐳 TESTING DOCKER CONNECTIVITY..." -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    try {
        # Test Docker daemon
        $dockerInfo = docker info 2>$null
        if ($dockerInfo) {
            Write-Host "  ✓ Docker daemon is running" -ForegroundColor Green
        } else {
            throw "Docker daemon not accessible"
        }
        
        # Test Docker Compose
        if (Test-Path "docker/docker-compose.yml") {
            Set-Location "docker"
            try {
                $composeConfig = docker-compose config 2>$null
                if ($composeConfig) {
                    Write-Host "  ✓ Docker Compose configuration is valid" -ForegroundColor Green
                } else {
                    Write-Host "  ⚠️  Docker Compose configuration has issues" -ForegroundColor Yellow
                }
            }
            finally {
                Set-Location ".."
            }
        }
        
        return $true
    }
    catch {
        Write-Host "  ❌ Docker connectivity issues: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Main execution
$startTime = Get-Date

if (-not $Force -and -not $CheckOnly) {
    Write-Host ""
    Write-Host "This script will set up and validate your development environment." -ForegroundColor Yellow
    $response = Read-Host "Continue? (Y/n)"
    if ($response -eq 'n' -or $response -eq 'N') {
        Write-Host "❌ Setup cancelled" -ForegroundColor Red
        exit 0
    }
}

try {
    # Check system requirements
    $systemRequirements = Test-SystemRequirements
    
    # Check directory structure
    Initialize-DirectoryStructure
    
    # Check required files
    Test-RequiredFiles
    
    # Setup environment variables
    if (-not $CheckOnly) {
        Initialize-EnvironmentVariables
    }
    
    # Test Docker connectivity
    $dockerOk = Test-DockerConnectivity
    
    # Summary
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-Host ""
    Write-Host "📊 SETUP SUMMARY" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "⏱️  Setup time: $($duration.Seconds) seconds" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "System Requirements:" -ForegroundColor Cyan
    foreach ($req in $systemRequirements) {
        $status = switch ($req.Status) {
            "OK" { "✓"; "Green" }
            "MISSING" { "❌"; "Red" }
            "OPTIONAL" { "⚠️ "; "Yellow" }
        }
        Write-Host "  $($status[0]) $($req.Name): $($req.Status)" -ForegroundColor $status[1]
    }
    
    Write-Host ""
    if ($dockerOk -and ($systemRequirements | Where-Object { $_.Name -eq "Docker" -and $_.Status -eq "OK" })) {
        Write-Host "🎉 Environment setup completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Run: .\scripts\02-reset-and-seed.ps1" -ForegroundColor White
        Write-Host "  2. Or run: .\scripts\03-create-database-tables.js" -ForegroundColor White
        exit 0
    } else {
        Write-Host "⚠️  Environment setup completed with warnings" -ForegroundColor Yellow
        Write-Host "Please address the issues above before proceeding." -ForegroundColor Yellow
        exit 1
    }
}
catch {
    Write-Host ""
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
