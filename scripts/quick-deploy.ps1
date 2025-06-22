#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Quick deployment workflow script

.DESCRIPTION
    This script provides a guided workflow for deploying to Vercel with all necessary checks and steps.

.PARAMETER Environment
    Target deployment environment

.PARAMETER AutoCommit
    Automatically commit and push changes

.EXAMPLE
    .\scripts\quick-deploy.ps1 -Environment staging
    .\scripts\quick-deploy.ps1 -Environment production -AutoCommit
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("staging", "production")]
    [string]$Environment,
    
    [switch]$AutoCommit
)

# Color functions
function Write-Info { param($Message) Write-Host "🔍 $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Step { param($Message) Write-Host "🚀 $Message" -ForegroundColor Magenta }

function Wait-ForUserInput {
    param([string]$Message = "Press Enter to continue...")
    Write-Host ""
    Write-Host $Message -ForegroundColor Yellow
    Read-Host
}

function Test-Command {
    param([string]$Command, [string]$Description)
    
    Write-Info "Running: $Description"
    $result = Invoke-Expression $Command
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "$Description completed successfully"
        return $true
    } else {
        Write-Error "$Description failed with exit code: $LASTEXITCODE"
        return $false
    }
}

Write-Host "🚀 QUICK DEPLOY TO $Environment" -ForegroundColor Magenta
Write-Host "="*50 -ForegroundColor Magenta
Write-Host ""

# Step 1: Validate Test Setup
Write-Step "Step 1: Validating Test Setup"
if (!(Test-Command "npm run test:validate-setup:verbose" "Test setup validation")) {
    Write-Error "Test setup validation failed. Please fix issues before deployment."
    exit 1
}

Wait-ForUserInput "Test setup validated. Continue with deployment checks?"

# Step 2: Run Deployment Check
Write-Step "Step 2: Running Deployment Readiness Check"
if (!(Test-Command "npm run deploy:check:verbose" "Deployment readiness check")) {
    Write-Error "Deployment check failed. Please fix issues before deployment."
    exit 1
}

Wait-ForUserInput "Deployment check passed. Continue with tests?"

# Step 3: Run Comprehensive Tests
Write-Step "Step 3: Running Comprehensive Tests"
if (!(Test-Command "npm run test:comprehensive:ci" "Comprehensive test suite")) {
    Write-Warning "Some tests failed. Do you want to continue anyway?"
    $continue = Read-Host "Continue deployment? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Info "Deployment cancelled by user."
        exit 1
    }
}

Wait-ForUserInput "Tests completed. Ready for deployment?"

# Step 4: Check Git Status
Write-Step "Step 4: Checking Git Status"
$gitStatus = git status --porcelain 2>&1

if ($gitStatus) {
    Write-Warning "Uncommitted changes detected:"
    git status --short
    
    if ($AutoCommit) {
        Write-Info "Auto-committing changes..."
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $commitMessage = "deploy: $Environment deployment - $timestamp"
        
        git add .
        git commit -m $commitMessage
        git push
        
        Write-Success "Changes committed and pushed"
    } else {
        Write-Info "Please commit your changes before deployment:"
        Write-Host "git add ." -ForegroundColor Cyan
        Write-Host "git commit -m 'deploy: $Environment deployment'" -ForegroundColor Cyan
        Write-Host "git push" -ForegroundColor Cyan
        
        Wait-ForUserInput "Commit changes and press Enter to continue..."
    }
}

# Step 5: Environment Variable Check
Write-Step "Step 5: Environment Variable Guidance"
Write-Info "Ensure these environment variables are set in Vercel:"

if ($Environment -eq "production") {
    Write-Host ""
    Write-Host "REQUIRED PRODUCTION VARIABLES:" -ForegroundColor Yellow
    Write-Host "- SUPABASE_URL (your cloud project URL)" -ForegroundColor Gray
    Write-Host "- SUPABASE_ANON_KEY (your cloud anon key)" -ForegroundColor Gray
    Write-Host "- SUPABASE_SERVICE_ROLE_KEY (your cloud service key)" -ForegroundColor Gray
    Write-Host "- NUXT_PUBLIC_SITE_URL (your domain)" -ForegroundColor Gray
    Write-Host "- JWT_SECRET (secure 256-bit secret)" -ForegroundColor Gray
    Write-Host "- JWT_REFRESH_SECRET (secure 256-bit secret)" -ForegroundColor Gray
    Write-Host "- API_SECRET_KEY (secure 32-char secret)" -ForegroundColor Gray
    Write-Host "- SESSION_SECRET (secure 32-char secret)" -ForegroundColor Gray
    Write-Host "- SYSTEM_USERNAME (for admin creation)" -ForegroundColor Gray
    Write-Host "- SYSTEM_PASSWORD (for admin creation)" -ForegroundColor Gray
    
    Write-Host ""
    Write-Info "Generate secrets with: npm run env:generate-secrets"
    Write-Info "Get Vercel commands with: npm run env:vercel-commands"
}

Wait-ForUserInput "Environment variables configured in Vercel?"

# Step 6: Deploy
Write-Step "Step 6: Deploying to $Environment"

$deployCommand = if ($Environment -eq "production") {
    "vercel --prod"
} else {
    "vercel"
}

Write-Info "Running: $deployCommand"
& $deployCommand

if ($LASTEXITCODE -eq 0) {
    Write-Success "Deployment to $Environment completed successfully!"
} else {
    Write-Error "Deployment failed with exit code: $LASTEXITCODE"
    exit 1
}

# Step 7: Post-Deployment
Write-Step "Step 7: Post-Deployment Tasks"

if ($Environment -eq "production") {
    Write-Info "Post-deployment checklist:"
    Write-Host "1. ✓ Test the deployed application" -ForegroundColor Green
    Write-Host "2. ✓ Create admin user via /sys/maintenance" -ForegroundColor Green
    Write-Host "3. ✓ Test authentication flows" -ForegroundColor Green
    Write-Host "4. ✓ Check all critical pages load" -ForegroundColor Green
    Write-Host "5. ✓ Monitor for any errors" -ForegroundColor Green
    
    Write-Host ""
    Write-Info "Quick tests you can run:"
    Write-Host "curl -X POST https://your-domain.vercel.app/api/system/login-test-simple \\" -ForegroundColor Cyan
    Write-Host "  -H 'Content-Type: application/json' \\" -ForegroundColor Cyan
    Write-Host "  -d '{\"test\": true}'" -ForegroundColor Cyan
} else {
    Write-Info "Staging deployment completed. Test thoroughly before production deployment."
}

Write-Host ""
Write-Success "🎉 Deployment to $Environment completed successfully!"
Write-Host ""
Write-Info "Your application should now be live at your Vercel URL."
Write-Info "Check the Vercel dashboard for deployment details and logs."
