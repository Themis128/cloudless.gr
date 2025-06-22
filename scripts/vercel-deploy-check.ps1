#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Deployment Readiness Check and Auto-Deploy Script for Vercel

.DESCRIPTION
    This script performs comprehensive checks to ensure the project is ready for Vercel deployment,
    provides insights and recommendations, and optionally executes the deployment process.

.PARAMETER CheckOnly
    Only perform checks without deploying

.PARAMETER AutoDeploy
    Automatically deploy after successful checks

.PARAMETER Environment
    Target environment (staging, production)

.PARAMETER CommitMessage
    Custom commit message for deployment

.PARAMETER SkipTests
    Skip running tests before deployment

.PARAMETER Verbose
    Enable verbose output

.EXAMPLE
    .\scripts\vercel-deploy-check.ps1 -CheckOnly
    .\scripts\vercel-deploy-check.ps1 -AutoDeploy -Environment staging
    .\scripts\vercel-deploy-check.ps1 -AutoDeploy -Environment production -CommitMessage "feat: new authentication system"
#>

param(
    [switch]$CheckOnly,
    [switch]$AutoDeploy,
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging",
    [string]$CommitMessage = "",
    [switch]$SkipTests,
    [switch]$Verbose
)

# Color functions for output
function Write-Info { param($Message) Write-Host "🔍 $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Step { param($Message) Write-Host "🚀 $Message" -ForegroundColor Magenta }

# Global variables
$script:Issues = @()
$script:Recommendations = @()
$script:ProjectRoot = Split-Path -Parent $PSScriptRoot

function Add-Issue {
    param([string]$Issue, [string]$Severity = "Warning")
    $script:Issues += @{ Issue = $Issue; Severity = $Severity }
    if ($Severity -eq "Error") {
        Write-Error $Issue
    } else {
        Write-Warning $Issue
    }
}

function Add-Recommendation {
    param([string]$Recommendation)
    $script:Recommendations += $Recommendation
    Write-Info $Recommendation
}

function Test-FileExists {
    param([string]$FilePath, [string]$Description)
    $FullPath = Join-Path $script:ProjectRoot $FilePath
    if (Test-Path $FullPath) {
        Write-Success "$Description exists: $FilePath"
        return $true
    } else {
        Add-Issue "$Description missing: $FilePath" -Severity "Error"
        return $false
    }
}

function Test-EnvironmentVariables {
    Write-Step "Checking Environment Variables..."
    
    # Check .env.example
    if (Test-FileExists ".env.example" ".env.example file") {
        $envExample = Get-Content (Join-Path $script:ProjectRoot ".env.example") -Raw
        
        # Required Vercel environment variables
        $requiredVars = @(
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY", 
            "SUPABASE_SERVICE_ROLE_KEY",
            "NUXT_PUBLIC_SITE_URL",
            "JWT_SECRET",
            "API_SECRET_KEY"
        )
        
        foreach ($var in $requiredVars) {
            if ($envExample -match $var) {
                Write-Success "Environment variable template found: $var"
            } else {
                Add-Issue "Missing environment variable template: $var" -Severity "Error"
            }
        }
    }
    
    # Check if .env exists (should not be committed)
    if (Test-Path (Join-Path $script:ProjectRoot ".env")) {
        Add-Issue ".env file exists - ensure it's in .gitignore" -Severity "Warning"
    } else {
        Write-Success ".env file not present (good for security)"
    }
    
    Add-Recommendation "Set environment variables in Vercel dashboard: https://vercel.com/dashboard/project/settings/environment-variables"
}

function Test-VercelConfiguration {
    Write-Step "Checking Vercel Configuration..."
    
    # Check for vercel.json
    $vercelJsonPath = Join-Path $script:ProjectRoot "vercel.json"
    if (-not (Test-Path $vercelJsonPath)) {
        Write-Warning "vercel.json not found. Creating recommended configuration..."
        
        $vercelConfig = @{
            "version" = 2
            "builds" = @(
                @{
                    "src" = "nuxt.config.ts"
                    "use" = "@nuxtjs/vercel-builder"
                }
            )
            "routes" = @(
                @{
                    "src" = "/api/(.*)"
                    "dest" = "/api/$1"
                }
            )
            "env" = @{
                "NUXT_PUBLIC_SITE_URL" = "https://your-domain.vercel.app"
            }
            "functions" = @{
                "server/api/**/*.ts" = @{
                    "maxDuration" = 30
                }
            }
        } | ConvertTo-Json -Depth 10
        
        $vercelConfig | Out-File -FilePath $vercelJsonPath -Encoding UTF8
        Write-Success "Created vercel.json with recommended configuration"
        Add-Recommendation "Update NUXT_PUBLIC_SITE_URL in vercel.json with your actual Vercel domain"
    } else {
        Write-Success "vercel.json exists"
    }
}

function Test-NuxtConfiguration {
    Write-Step "Checking Nuxt Configuration..."
    
    $nuxtConfigPath = Join-Path $script:ProjectRoot "nuxt.config.ts"
    if (Test-Path $nuxtConfigPath) {
        $nuxtConfig = Get-Content $nuxtConfigPath -Raw
        
        # Check SSR setting
        if ($nuxtConfig -match "ssr:\s*false") {
            Write-Warning "SSR is disabled. Consider enabling for better SEO and performance on Vercel"
            Add-Recommendation "Set 'ssr: true' in nuxt.config.ts for production deployment"
        }
        
        # Check build configuration
        if ($nuxtConfig -match "nitro") {
            Write-Success "Nitro configuration found"
        } else {
            Add-Recommendation "Consider adding Nitro configuration for Vercel deployment"
        }
        
        # Check for Supabase configuration
        if ($nuxtConfig -match "@nuxtjs/supabase") {
            Write-Success "Supabase module configured"
        } else {
            Add-Issue "Supabase module not found in configuration" -Severity "Error"
        }
        
        Write-Success "Nuxt configuration looks good"
    } else {
        Add-Issue "nuxt.config.ts not found" -Severity "Error"
    }
}

function Test-Dependencies {
    Write-Step "Checking Dependencies..."
    
    $packageJsonPath = Join-Path $script:ProjectRoot "package.json"
    if (Test-Path $packageJsonPath) {
        $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
        
        # Check for Vercel-specific dependencies
        $vercelDeps = @("@nuxtjs/vercel-builder", "vercel")
        foreach ($dep in $vercelDeps) {
            if ($packageJson.dependencies.$dep -or $packageJson.devDependencies.$dep) {
                Write-Success "Vercel dependency found: $dep"
            } else {
                Write-Warning "Consider adding Vercel dependency: $dep"
            }
        }
        
        # Check Node.js version compatibility
        if ($packageJson.engines -and $packageJson.engines.node) {
            Write-Success "Node.js version specified: $($packageJson.engines.node)"
        } else {
            Add-Recommendation "Specify Node.js version in package.json engines field"
        }
        
        Write-Success "Dependencies check completed"
    } else {
        Add-Issue "package.json not found" -Severity "Error"
    }
}

function Test-BuildProcess {
    Write-Step "Testing Build Process..."
    
    try {
        Write-Info "Running 'npm run build'..."
        $buildOutput = npm run build 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Build successful"
            
            # Check if .output directory exists
            $outputDir = Join-Path $script:ProjectRoot ".output"
            if (Test-Path $outputDir) {
                Write-Success ".output directory created"
                
                # Check for key build artifacts
                $serverDir = Join-Path $outputDir "server"
                $publicDir = Join-Path $outputDir "public"
                
                if (Test-Path $serverDir) {
                    Write-Success "Server build artifacts found"
                } else {
                    Add-Issue "Server build artifacts missing" -Severity "Warning"
                }
                
                if (Test-Path $publicDir) {
                    Write-Success "Public build artifacts found"
                } else {
                    Add-Issue "Public build artifacts missing" -Severity "Warning"
                }
            } else {
                Add-Issue ".output directory not found after build" -Severity "Error"
            }
        } else {
            Add-Issue "Build failed. Output: $buildOutput" -Severity "Error"
        }
    } catch {
        Add-Issue "Build process failed: $($_.Exception.Message)" -Severity "Error"
    }
}

function Test-GitRepository {
    Write-Step "Checking Git Repository..."
    
    # Check if it's a git repository
    if (Test-Path (Join-Path $script:ProjectRoot ".git")) {
        Write-Success "Git repository initialized"
        
        # Check for uncommitted changes
        $gitStatus = git status --porcelain 2>&1
        if ($gitStatus) {
            Write-Warning "Uncommitted changes detected:"
            $gitStatus | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
            Add-Recommendation "Commit changes before deployment"
        } else {
            Write-Success "No uncommitted changes"
        }
        
        # Check for remote repository
        $gitRemote = git remote -v 2>&1
        if ($gitRemote -and $gitRemote -notmatch "fatal:") {
            Write-Success "Git remote configured"
            $gitRemote | ForEach-Object { Write-Host "  $_" -ForegroundColor Cyan }
        } else {
            Add-Issue "No git remote configured" -Severity "Warning"
            Add-Recommendation "Add git remote: git remote add origin <repository-url>"
        }
        
        # Check current branch
        $currentBranch = git branch --show-current 2>&1
        if ($currentBranch) {
            Write-Success "Current branch: $currentBranch"
            if ($currentBranch -ne "main" -and $currentBranch -ne "master") {
                Add-Recommendation "Consider deploying from main/master branch for production"
            }
        }
    } else {
        Add-Issue "Not a git repository" -Severity "Error"
        Add-Recommendation "Initialize git repository: git init"
    }
}

function Test-SupabaseConnection {
    Write-Step "Testing Supabase Connection..."
    
    # Check if Supabase CLI is available
    try {
        $supabaseVersion = supabase --version 2>&1
        Write-Success "Supabase CLI available: $supabaseVersion"
        
        # Check Supabase project status
        try {
            $supabaseStatus = supabase status 2>&1
            if ($supabaseStatus -match "RUNNING" -or $supabaseStatus -match "API URL") {
                Write-Success "Supabase project accessible"
            } else {
                Add-Issue "Supabase project not accessible" -Severity "Warning"
            }
        } catch {
            Add-Issue "Could not check Supabase status" -Severity "Warning"
        }
    } catch {
        Add-Issue "Supabase CLI not available" -Severity "Warning"
        Add-Recommendation "Install Supabase CLI: npm install -g supabase"
    }
}

function Test-SecurityChecks {
    Write-Step "Performing Security Checks..."
    
    # Check .gitignore
    $gitignorePath = Join-Path $script:ProjectRoot ".gitignore"
    if (Test-Path $gitignorePath) {
        $gitignore = Get-Content $gitignorePath -Raw
        
        $sensitiveFiles = @(".env", "*.env", ".env.local", "node_modules", ".output", ".vercel")
        foreach ($file in $sensitiveFiles) {
            if ($gitignore -match [regex]::Escape($file)) {
                Write-Success "Sensitive file/directory ignored: $file"
            } else {
                Add-Issue "Sensitive file/directory not in .gitignore: $file" -Severity "Warning"
            }
        }
    } else {
        Add-Issue ".gitignore file missing" -Severity "Error"
    }
    
    # Check for exposed secrets
    $searchPaths = @("pages", "components", "composables", "stores", "middleware", "server")
    foreach ($path in $searchPaths) {
        $fullPath = Join-Path $script:ProjectRoot $path
        if (Test-Path $fullPath) {
            $secretPatterns = @(
                "password\s*=\s*['\"][^'\"]+['\"]",
                "secret\s*=\s*['\"][^'\"]+['\"]",
                "key\s*=\s*['\"][A-Za-z0-9+/]{20,}['\"]"
            )
            
            foreach ($pattern in $secretPatterns) {
                $results = Select-String -Path "$fullPath\*" -Pattern $pattern -Recurse 2>$null
                if ($results) {
                    Add-Issue "Potential hardcoded secret found in $path" -Severity "Warning"
                }
            }
        }
    }
}

function Run-ComprehensiveTests {
    if ($SkipTests) {
        Write-Warning "Skipping tests as requested"
        return $true
    }
    
    Write-Step "Running Comprehensive Tests..."
    
    try {
        Write-Info "Running test validation..."
        & "$script:ProjectRoot\scripts\validate-test-setup.ps1"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Running comprehensive test suite..."
            & "$script:ProjectRoot\scripts\run-comprehensive-tests.ps1" -TestSuite all -Environment local -Headless -GenerateReport -VerboseOutput
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "All tests passed"
                return $true
            } else {
                Add-Issue "Some tests failed" -Severity "Error"
                return $false
            }
        } else {
            Add-Issue "Test setup validation failed" -Severity "Error"
            return $false
        }
    } catch {
        Add-Issue "Error running tests: $($_.Exception.Message)" -Severity "Error"
        return $false
    }
}

function Show-Summary {
    Write-Host "`n" + "="*80 -ForegroundColor Cyan
    Write-Host "DEPLOYMENT READINESS SUMMARY" -ForegroundColor Cyan
    Write-Host "="*80 -ForegroundColor Cyan
    
    if ($script:Issues.Count -eq 0) {
        Write-Success "✅ No issues found! Your project is ready for Vercel deployment."
    } else {
        Write-Host "`nISSUES FOUND:" -ForegroundColor Red
        $errorCount = ($script:Issues | Where-Object { $_.Severity -eq "Error" }).Count
        $warningCount = ($script:Issues | Where-Object { $_.Severity -eq "Warning" }).Count
        
        Write-Host "  Errors: $errorCount" -ForegroundColor Red
        Write-Host "  Warnings: $warningCount" -ForegroundColor Yellow
        
        foreach ($issue in $script:Issues) {
            $color = if ($issue.Severity -eq "Error") { "Red" } else { "Yellow" }
            $icon = if ($issue.Severity -eq "Error") { "❌" } else { "⚠️" }
            Write-Host "  $icon $($issue.Issue)" -ForegroundColor $color
        }
    }
    
    if ($script:Recommendations.Count -gt 0) {
        Write-Host "`nRECOMMENDATIONS:" -ForegroundColor Cyan
        foreach ($rec in $script:Recommendations) {
            Write-Host "  💡 $rec" -ForegroundColor Cyan
        }
    }
    
    # Deployment instructions
    Write-Host "`nDEPLOYMENT INSTRUCTIONS:" -ForegroundColor Magenta
    Write-Host "  1. Install Vercel CLI: npm install -g vercel" -ForegroundColor White
    Write-Host "  2. Login to Vercel: vercel login" -ForegroundColor White
    Write-Host "  3. Link project: vercel link" -ForegroundColor White
    Write-Host "  4. Set environment variables in Vercel dashboard" -ForegroundColor White
    Write-Host "  5. Deploy: vercel --prod" -ForegroundColor White
    
    Write-Host "`nQUICK DEPLOYMENT COMMANDS:" -ForegroundColor Magenta
    Write-Host "  # Staging deployment:" -ForegroundColor Yellow
    Write-Host "  git add . && git commit -m 'Deploy to staging' && git push && vercel" -ForegroundColor White
    Write-Host "  # Production deployment:" -ForegroundColor Yellow
    Write-Host "  git add . && git commit -m 'Deploy to production' && git push && vercel --prod" -ForegroundColor White
}

function Start-AutoDeployment {
    param([string]$TargetEnvironment, [string]$Message)
    
    Write-Step "Starting Auto-Deployment Process..."
    
    # Ensure we have no critical errors
    $errors = $script:Issues | Where-Object { $_.Severity -eq "Error" }
    if ($errors.Count -gt 0) {
        Write-Error "Cannot deploy with critical errors. Please fix them first."
        return $false
    }
    
    # Prepare commit message
    if (-not $Message) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $Message = "deploy: $TargetEnvironment deployment - $timestamp"
    }
    
    try {
        # Stage all changes
        Write-Info "Staging changes..."
        git add .
        
        # Check if there are changes to commit
        $changes = git diff --cached --name-only 2>&1
        if ($changes) {
            Write-Info "Committing changes..."
            git commit -m $Message
            
            Write-Info "Pushing to repository..."
            git push
        } else {
            Write-Info "No changes to commit"
        }
        
        # Deploy to Vercel
        Write-Info "Deploying to Vercel..."
        if ($TargetEnvironment -eq "production") {
            vercel --prod
        } else {
            vercel
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Deployment completed successfully!"
            Write-Info "Check your deployment at: https://vercel.com/dashboard"
            return $true
        } else {
            Write-Error "Deployment failed"
            return $false
        }
    } catch {
        Write-Error "Deployment process failed: $($_.Exception.Message)"
        return $false
    }
}

# Main execution
function Main {
    Write-Host "🚀 VERCEL DEPLOYMENT READINESS CHECK" -ForegroundColor Magenta
    Write-Host "="*50 -ForegroundColor Magenta
    Write-Host "Project: $script:ProjectRoot" -ForegroundColor Cyan
    Write-Host "Environment: $Environment" -ForegroundColor Cyan
    Write-Host "Mode: $(if ($AutoDeploy) { 'Auto-Deploy' } else { 'Check Only' })" -ForegroundColor Cyan
    Write-Host ""
    
    # Run all checks
    Test-EnvironmentVariables
    Test-VercelConfiguration
    Test-NuxtConfiguration
    Test-Dependencies
    Test-GitRepository
    Test-SupabaseConnection
    Test-SecurityChecks
    Test-BuildProcess
    
    # Run tests if not skipped
    $testsPass = Run-ComprehensiveTests
    
    # Show summary
    Show-Summary
    
    # Auto-deploy if requested and no critical errors
    if ($AutoDeploy -and $testsPass) {
        $errors = $script:Issues | Where-Object { $_.Severity -eq "Error" }
        if ($errors.Count -eq 0) {
            $deployed = Start-AutoDeployment -TargetEnvironment $Environment -Message $CommitMessage
            if ($deployed) {
                Write-Success "`n🎉 Deployment completed successfully!"
            }
        } else {
            Write-Error "`n❌ Cannot auto-deploy due to critical errors. Please fix them first."
        }
    }
    
    Write-Host "`n" + "="*80 -ForegroundColor Magenta
    Write-Host "DEPLOYMENT CHECK COMPLETED" -ForegroundColor Magenta
    Write-Host "="*80 -ForegroundColor Magenta
}

# Execute main function
Main
