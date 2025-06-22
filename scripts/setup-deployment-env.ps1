#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Environment configuration script for Vercel deployment

.DESCRIPTION
    This script helps configure environment variables for different deployment environments
    and provides guidance on production setup.

.PARAMETER Environment
    Target environment: local, staging, production

.PARAMETER GenerateSecrets
    Generate new secure secrets for production

.PARAMETER ShowExample
    Show example environment variable configuration

.PARAMETER ExportForVercel
    Generate commands for setting variables in Vercel CLI

.EXAMPLE
    .\scripts\setup-deployment-env.ps1 -Environment production -GenerateSecrets
    .\scripts\setup-deployment-env.ps1 -ShowExample
    .\scripts\setup-deployment-env.ps1 -ExportForVercel
#>

param(
    [ValidateSet("local", "staging", "production")]
    [string]$Environment = "local",
    [switch]$GenerateSecrets,
    [switch]$ShowExample,
    [switch]$ExportForVercel
)

# Color functions
function Write-Info { param($Message) Write-Host "🔍 $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Step { param($Message) Write-Host "🚀 $Message" -ForegroundColor Magenta }

function Generate-SecureSecret {
    param([int]$Length = 32)
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    return -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

function Generate-JWT-Secret {
    # Generate a secure 256-bit (32 byte) secret for JWT
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

function Show-ExampleConfiguration {
    Write-Step "Example Environment Variable Configuration"
    Write-Host ""
    
    Write-Info "=== LOCAL DEVELOPMENT (.env) ==="
    Write-Host @"
# Supabase Local Configuration
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Application Configuration
NUXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
PORT=3000

# Development Secrets (not for production)
JWT_SECRET=dev-jwt-secret-key-for-local-development-only
JWT_REFRESH_SECRET=dev-refresh-secret-key-for-local-development-only
API_SECRET_KEY=dev-api-secret-key-for-local-development-only
SESSION_SECRET=dev-session-secret-key-for-local-development-only

# System Admin (Local testing)
SYSTEM_USERNAME=devsystem
SYSTEM_PASSWORD=devpassword123
"@ -ForegroundColor Gray
    
    Write-Host ""
    Write-Info "=== VERCEL PRODUCTION ENVIRONMENT ==="
    Write-Host @"
# Supabase Cloud Configuration (GET FROM YOUR SUPABASE PROJECT)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGc... (your production anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (your production service role key)

# Production Application Configuration
NUXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
NODE_ENV=production

# Production Secrets (GENERATE NEW ONES!)
JWT_SECRET=your-production-jwt-secret-256-bit
JWT_REFRESH_SECRET=your-production-refresh-secret-256-bit
API_SECRET_KEY=your-production-api-secret-32-chars
SESSION_SECRET=your-production-session-secret-32-chars

# System Admin (Production - SECURE THESE!)
SYSTEM_USERNAME=your-secure-system-username
SYSTEM_PASSWORD=your-secure-system-password
"@ -ForegroundColor Gray
}

function Generate-ProductionSecrets {
    Write-Step "Generating Production Secrets"
    Write-Host ""
    
    $jwtSecret = Generate-JWT-Secret
    $jwtRefreshSecret = Generate-JWT-Secret
    $apiSecret = Generate-SecureSecret -Length 32
    $sessionSecret = Generate-SecureSecret -Length 32
    $systemUsername = "admin_$(Get-Random -Minimum 1000 -Maximum 9999)"
    $systemPassword = Generate-SecureSecret -Length 24
    
    Write-Success "Generated secure secrets for production:"
    Write-Host ""
    
    Write-Host "JWT_SECRET=$jwtSecret" -ForegroundColor Green
    Write-Host "JWT_REFRESH_SECRET=$jwtRefreshSecret" -ForegroundColor Green  
    Write-Host "API_SECRET_KEY=$apiSecret" -ForegroundColor Green
    Write-Host "SESSION_SECRET=$sessionSecret" -ForegroundColor Green
    Write-Host "SYSTEM_USERNAME=$systemUsername" -ForegroundColor Green
    Write-Host "SYSTEM_PASSWORD=$systemPassword" -ForegroundColor Green
    
    Write-Host ""
    Write-Warning "IMPORTANT: Save these secrets securely! They cannot be regenerated."
    Write-Warning "Use these in your Vercel environment variables."
    
    return @{
        JWT_SECRET = $jwtSecret
        JWT_REFRESH_SECRET = $jwtRefreshSecret
        API_SECRET_KEY = $apiSecret
        SESSION_SECRET = $sessionSecret
        SYSTEM_USERNAME = $systemUsername
        SYSTEM_PASSWORD = $systemPassword
    }
}

function Export-VercelCommands {
    param($Secrets)
    
    Write-Step "Vercel CLI Commands"
    Write-Host ""
    Write-Info "Run these commands to set environment variables in Vercel:"
    Write-Host ""
    
    $commands = @(
        "# Core Supabase Configuration (UPDATE WITH YOUR VALUES)",
        "vercel env add SUPABASE_URL production",
        "vercel env add SUPABASE_ANON_KEY production", 
        "vercel env add SUPABASE_SERVICE_ROLE_KEY production",
        "",
        "# Application Configuration",
        "vercel env add NUXT_PUBLIC_SITE_URL production",
        "vercel env add NODE_ENV production",
        "",
        "# Security Secrets"
    )
    
    if ($Secrets) {
        $commands += @(
            "echo '$($Secrets.JWT_SECRET)' | vercel env add JWT_SECRET production",
            "echo '$($Secrets.JWT_REFRESH_SECRET)' | vercel env add JWT_REFRESH_SECRET production",
            "echo '$($Secrets.API_SECRET_KEY)' | vercel env add API_SECRET_KEY production", 
            "echo '$($Secrets.SESSION_SECRET)' | vercel env add SESSION_SECRET production",
            "echo '$($Secrets.SYSTEM_USERNAME)' | vercel env add SYSTEM_USERNAME production",
            "echo '$($Secrets.SYSTEM_PASSWORD)' | vercel env add SYSTEM_PASSWORD production"
        )
    } else {
        $commands += @(
            "vercel env add JWT_SECRET production",
            "vercel env add JWT_REFRESH_SECRET production",
            "vercel env add API_SECRET_KEY production",
            "vercel env add SESSION_SECRET production", 
            "vercel env add SYSTEM_USERNAME production",
            "vercel env add SYSTEM_PASSWORD production"
        )
    }
    
    foreach ($cmd in $commands) {
        if ($cmd.StartsWith("#") -or $cmd -eq "") {
            Write-Host $cmd -ForegroundColor Yellow
        } else {
            Write-Host $cmd -ForegroundColor Cyan
        }
    }
    
    Write-Host ""
    Write-Info "Alternative: Use Vercel Dashboard"
    Write-Host "1. Go to https://vercel.com/dashboard" -ForegroundColor Gray
    Write-Host "2. Select your project" -ForegroundColor Gray
    Write-Host "3. Go to Settings > Environment Variables" -ForegroundColor Gray
    Write-Host "4. Add each variable for the Production environment" -ForegroundColor Gray
}

function Show-EnvironmentStatus {
    param([string]$Env)
    
    Write-Step "Environment Status: $Env"
    Write-Host ""
    
    switch ($Env) {
        "local" {
            $envFile = ".env"
            if (Test-Path $envFile) {
                Write-Success "Local .env file exists"
                
                $content = Get-Content $envFile -Raw
                $requiredVars = @("SUPABASE_URL", "SUPABASE_ANON_KEY", "JWT_SECRET")
                
                foreach ($var in $requiredVars) {
                    if ($content -match "$var=") {
                        Write-Success "✓ $var configured"
                    } else {
                        Write-Warning "✗ $var missing"
                    }
                }
            } else {
                Write-Warning "No .env file found"
                Write-Info "Copy .env.example to .env and configure it"
            }
        }
        "staging" {
            Write-Info "Staging environment uses same configuration as production"
            Write-Info "Deploy with: npm run deploy:staging"
        }
        "production" {
            Write-Info "Production environment requires:"
            Write-Host "1. Supabase Cloud project configured" -ForegroundColor Gray
            Write-Host "2. Environment variables set in Vercel" -ForegroundColor Gray
            Write-Host "3. Custom domain configured (optional)" -ForegroundColor Gray
            Write-Host "4. Database migrations applied" -ForegroundColor Gray
        }
    }
}

function Main {
    Write-Host "🚀 VERCEL DEPLOYMENT ENVIRONMENT SETUP" -ForegroundColor Magenta
    Write-Host "="*50 -ForegroundColor Magenta
    Write-Host ""
    
    if ($ShowExample) {
        Show-ExampleConfiguration
        return
    }
    
    $secrets = $null
    if ($GenerateSecrets) {
        $secrets = Generate-ProductionSecrets
    }
    
    if ($ExportForVercel) {
        Export-VercelCommands -Secrets $secrets
    }
    
    Show-EnvironmentStatus -Env $Environment
    
    Write-Host ""
    Write-Step "Next Steps for $Environment Deployment:"
    
    switch ($Environment) {
        "local" {
            Write-Host "1. Ensure .env file is configured" -ForegroundColor Cyan
            Write-Host "2. Run: npm run dev" -ForegroundColor Cyan
            Write-Host "3. Test: npm run test:comprehensive" -ForegroundColor Cyan
        }
        "staging" {
            Write-Host "1. Set environment variables in Vercel" -ForegroundColor Cyan
            Write-Host "2. Run: npm run deploy:staging" -ForegroundColor Cyan
            Write-Host "3. Test: npm run test:comprehensive:staging" -ForegroundColor Cyan
        }
        "production" {
            Write-Host "1. Generate production secrets (if not done)" -ForegroundColor Cyan
            Write-Host "2. Set all environment variables in Vercel" -ForegroundColor Cyan
            Write-Host "3. Run: npm run deploy:production" -ForegroundColor Cyan
            Write-Host "4. Create admin user via /sys/maintenance" -ForegroundColor Cyan
            Write-Host "5. Test all functionality" -ForegroundColor Cyan
        }
    }
    
    Write-Host ""
    Write-Success "Environment setup completed for: $Environment"
}

# Execute main function
Main
