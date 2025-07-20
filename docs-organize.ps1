# Documentation Organization Script for Cloudless.gr
Write-Host "🗂️ Organizing documentation files..." -ForegroundColor Green

# Create directory structure
Write-Host "📁 Creating directory structure..." -ForegroundColor Blue
New-Item -ItemType Directory -Path "docs/development" -Force | Out-Null
New-Item -ItemType Directory -Path "docs/docker" -Force | Out-Null
New-Item -ItemType Directory -Path "docs/deployment" -Force | Out-Null
New-Item -ItemType Directory -Path "docs/workflows" -Force | Out-Null
New-Item -ItemType Directory -Path "docs/security" -Force | Out-Null
New-Item -ItemType Directory -Path "docs/troubleshooting" -Force | Out-Null
New-Item -ItemType Directory -Path "docs/project" -Force | Out-Null

# Move files with error handling
function Move-FileIfExists {
    param($Source, $Destination)
    if (Test-Path $Source) {
        Move-Item $Source $Destination -Force
        Write-Host "✅ Moved $Source to $Destination" -ForegroundColor Green
    } else {
        Write-Host "⚠️ File not found: $Source" -ForegroundColor Yellow
    }
}

Write-Host "📝 Moving documentation files..." -ForegroundColor Blue

# Development files
Move-FileIfExists "DEV_README.md" "docs/development/"
Move-FileIfExists "DEV_ENVIRONMENT.md" "docs/development/"
Move-FileIfExists "DEV_OPTIMIZATION_GUIDE.md" "docs/development/"
Move-FileIfExists "FAST_DEV_STARTUP.md" "docs/development/"
Move-FileIfExists "ESLINT_AUTOFIX_GUIDE.md" "docs/development/"
Move-FileIfExists "API_INTEGRATION_GUIDE.md" "docs/development/"

# Docker files
Move-FileIfExists "DOCKER-DEV.md" "docs/docker/"
Move-FileIfExists "DOCKER-BEST-PRACTICES.md" "docs/docker/"
Move-FileIfExists "DOCKER_COMMANDS.md" "docs/docker/"
Move-FileIfExists "DOCKER_VERSIONING.md" "docs/docker/"
Move-FileIfExists "DOCKER_WORKFLOW_FIXES.md" "docs/docker/"
Move-FileIfExists "DOCKER_SUPABASE_CONNECTION.md" "docs/docker/"

# Deployment files
Move-FileIfExists "PRODUCTION_ENV_SETUP.md" "docs/deployment/"
Move-FileIfExists "DEV_CONTAINER_SUPABASE_FIX.md" "docs/deployment/"

# Workflow files
Move-FileIfExists "GITHUB_WORKFLOWS_SUMMARY.md" "docs/workflows/"
Move-FileIfExists "WORKFLOW_CONSOLIDATION_SUMMARY.md" "docs/workflows/"
Move-FileIfExists "SEQUENTIAL_WORKFLOW_GUIDE.md" "docs/workflows/"
Move-FileIfExists "WORKFLOW_TESTING_GUIDE.md" "docs/workflows/"
Move-FileIfExists ".github/workflows/CONFIGURATION_SUMMARY.md" "docs/workflows/"

# Security files
Move-FileIfExists "SECRETS_SCAN_ANALYSIS.md" "docs/security/"
Move-FileIfExists "SECURITY_WORKFLOW_STATUS.md" "docs/security/"
Move-FileIfExists "REDIS_CI_FIX.md" "docs/security/"

# Troubleshooting files
Move-FileIfExists "TIMER_FIX_README.md" "docs/troubleshooting/"
Move-FileIfExists "SERVER_DEBUGGING_IMPROVEMENTS.md" "docs/troubleshooting/"
Move-FileIfExists "CI_SERVER_STARTUP_FIXES.md" "docs/troubleshooting/"

# Project files
Move-FileIfExists "PROJECT_STRUCTURE.md" "docs/project/"

Write-Host "🎉 Documentation organization complete!" -ForegroundColor Green
Write-Host "📚 Check the docs/ folder for organized documentation" -ForegroundColor Cyan 