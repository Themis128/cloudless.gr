#!/usr/bin/env pwsh

# Cloudless Production GitHub Secrets Setup Script
# This script helps you set up GitHub secrets for production environment variables

param(
    [string]$RepoOwner = "",
    [string]$RepoName = "",
    [switch]$Interactive
)

# Colors for output
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Blue = "`e[34m"
$Reset = "`e[0m"

Write-Host "${Blue}🔧 Cloudless Production GitHub Secrets Setup${Reset}" -ForegroundColor Blue
Write-Host "This script will help you set up GitHub secrets for production deployment." -ForegroundColor White
Write-Host ""

# Check if gh CLI is installed
try {
    gh --version | Out-Null
    Write-Host "${Green}✅ GitHub CLI is installed${Reset}" -ForegroundColor Green
}
catch {
    Write-Host "${Red}❌ GitHub CLI is not installed${Reset}" -ForegroundColor Red
    Write-Host "Please install GitHub CLI from: https://cli.github.com/" -ForegroundColor Yellow
    exit 1
}

# Check if user is authenticated
try {
    $authStatus = gh auth status
    Write-Host "${Green}✅ GitHub CLI is authenticated${Reset}" -ForegroundColor Green
}
catch {
    Write-Host "${Red}❌ GitHub CLI is not authenticated${Reset}" -ForegroundColor Red
    Write-Host "Please run: gh auth login" -ForegroundColor Yellow
    exit 1
}

# Get repository information
if ($Interactive) {
    if (-not $RepoOwner) {
        $RepoOwner = Read-Host "Enter repository owner (e.g., your-username)"
    }
    if (-not $RepoName) {
        $RepoName = Read-Host "Enter repository name (e.g., cloudless.gr)"
    }
}

if (-not $RepoOwner -or -not $RepoName) {
    Write-Host "${Red}❌ Repository owner and name are required${Reset}" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "${Blue}📋 Required Production Environment Variables:${Reset}" -ForegroundColor Blue
Write-Host ""

# Define the secrets that need to be set
$secrets = @{
    # Supabase Configuration
    "NUXT_PUBLIC_SUPABASE_URL"      = "Your Supabase project URL (e.g., https://your-project.supabase.co)"
    "NUXT_PUBLIC_SUPABASE_ANON_KEY" = "Your Supabase anonymous key"
    "SUPABASE_SERVICE_ROLE_KEY"     = "Your Supabase service role key"
    
    # Database Configuration
    "DATABASE_URL"                  = "Production database connection string"
    
    # Redis Configuration
    "REDIS_URL"                     = "Production Redis connection string"
    "REDIS_MAX_MEMORY"              = "Redis max memory (e.g., 256mb)"
    
    # External API Keys
    "OPENAI_API_KEY"                = "Your OpenAI API key"
    "ANTHROPIC_API_KEY"             = "Your Anthropic API key"
    
    # Security
    "SESSION_SECRET"                = "Random session secret for production"
    "JWT_SECRET"                    = "Random JWT secret for production"
    
    # Monitoring
    "SENTRY_DSN"                    = "Your Sentry DSN for error tracking"
    
    # Docker Configuration
    "DOCKER_REGISTRY"               = "Your Docker registry URL (optional)"
    "IMAGE_TAG"                     = "Docker image tag (e.g., latest, v1.0.0)"
}

# Display current secrets status
Write-Host "${Yellow}🔍 Checking current GitHub secrets...${Reset}" -ForegroundColor Yellow
try {
    $currentSecrets = gh secret list --repo "$RepoOwner/$RepoName" --json name, visibility, updatedAt
    $existingSecrets = ($currentSecrets | ConvertFrom-Json).name
    Write-Host "${Green}✅ Successfully retrieved current secrets${Reset}" -ForegroundColor Green
}
catch {
    Write-Host "${Red}❌ Failed to retrieve current secrets${Reset}" -ForegroundColor Red
    $existingSecrets = @()
}

Write-Host ""
Write-Host "${Blue}📊 Current Secrets Status:${Reset}" -ForegroundColor Blue

foreach ($secret in $secrets.Keys) {
    if ($existingSecrets -contains $secret) {
        Write-Host "  ${Green}✅ $secret${Reset}" -ForegroundColor Green
    }
    else {
        Write-Host "  ${Red}❌ $secret${Reset}" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "${Yellow}⚠️  IMPORTANT:${Reset}" -ForegroundColor Yellow
Write-Host "1. Make sure you have your production Supabase credentials ready"
Write-Host "2. Ensure your production database and Redis are accessible"
Write-Host "3. Have your API keys for OpenAI and Anthropic ready"
Write-Host "4. Generate secure random strings for SESSION_SECRET and JWT_SECRET"
Write-Host ""

if ($Interactive) {
    $continue = Read-Host "Do you want to set up missing secrets? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "${Yellow}Setup cancelled.${Reset}" -ForegroundColor Yellow
        exit 0
    }
}

# Function to set a secret
function Set-GitHubSecret {
    param(
        [string]$SecretName,
        [string]$Description
    )
    
    if ($existingSecrets -contains $SecretName) {
        Write-Host "${Yellow}⚠️  $SecretName already exists. Skipping...${Reset}" -ForegroundColor Yellow
        return
    }
    
    Write-Host ""
    Write-Host "${Blue}🔐 Setting up: $SecretName${Reset}" -ForegroundColor Blue
    Write-Host "Description: $Description" -ForegroundColor White
    
    $value = Read-Host "Enter value for $SecretName" -AsSecureString
    $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($value))
    
    if ($plainValue) {
        try {
            $plainValue | gh secret set $SecretName --repo "$RepoOwner/$RepoName"
            Write-Host "${Green}✅ Successfully set $SecretName${Reset}" -ForegroundColor Green
        }
        catch {
            Write-Host "${Red}❌ Failed to set $SecretName${Reset}" -ForegroundColor Red
        }
    }
    else {
        Write-Host "${Yellow}⚠️  Skipping $SecretName (empty value)${Reset}" -ForegroundColor Yellow
    }
}

# Set up missing secrets
foreach ($secret in $secrets.Keys) {
    if ($existingSecrets -notcontains $secret) {
        Set-GitHubSecret -SecretName $secret -Description $secrets[$secret]
    }
}

Write-Host ""
Write-Host "${Green}🎉 GitHub secrets setup completed!${Reset}" -ForegroundColor Green
Write-Host ""
Write-Host "${Blue}📋 Next Steps:${Reset}" -ForegroundColor Blue
Write-Host "1. Verify all secrets are set: gh secret list --repo $RepoOwner/$RepoName"
Write-Host "2. Update your GitHub Actions workflows to use these secrets"
Write-Host "3. Test your production deployment"
Write-Host "4. Monitor your application logs for any configuration issues"
Write-Host ""

# Generate sample workflow configuration
Write-Host "${Blue}📝 Sample GitHub Actions Environment Configuration:${Reset}" -ForegroundColor Blue
Write-Host @"
```yaml
env:
  NUXT_PUBLIC_SUPABASE_URL: `${{ secrets.NUXT_PUBLIC_SUPABASE_URL }}
  NUXT_PUBLIC_SUPABASE_ANON_KEY: `${{ secrets.NUXT_PUBLIC_SUPABASE_ANON_KEY }}
  SUPABASE_SERVICE_ROLE_KEY: `${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
  DATABASE_URL: `${{ secrets.DATABASE_URL }}
  REDIS_URL: `${{ secrets.REDIS_URL }}
  REDIS_MAX_MEMORY: `${{ secrets.REDIS_MAX_MEMORY }}
  OPENAI_API_KEY: `${{ secrets.OPENAI_API_KEY }}
  ANTHROPIC_API_KEY: `${{ secrets.ANTHROPIC_API_KEY }}
  SESSION_SECRET: `${{ secrets.SESSION_SECRET }}
  JWT_SECRET: `${{ secrets.JWT_SECRET }}
  SENTRY_DSN: `${{ secrets.SENTRY_DSN }}
  DOCKER_REGISTRY: `${{ secrets.DOCKER_REGISTRY }}
  IMAGE_TAG: `${{ secrets.IMAGE_TAG }}
```
"@ -ForegroundColor Cyan

Write-Host ""
Write-Host "${Green}✅ Setup complete!${Reset}" -ForegroundColor Green 