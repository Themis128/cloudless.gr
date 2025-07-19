#!/usr/bin/env pwsh

# Cloudless Environment Setup Script
# This script helps you set up your .env file from the template

param(
    [switch]$Force
)

# Colors for output
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Blue = "`e[34m"
$Reset = "`e[0m"

Write-Host "${Blue}🔧 Cloudless Environment Setup${Reset}" -ForegroundColor Blue
Write-Host "This script will help you set up your .env file from the template." -ForegroundColor White
Write-Host ""

# Check if .env already exists
if (Test-Path ".env") {
    if ($Force) {
        Write-Host "${Yellow}⚠️  .env file already exists. Overwriting due to -Force flag.${Reset}" -ForegroundColor Yellow
    }
    else {
        Write-Host "${Red}❌ .env file already exists.${Reset}" -ForegroundColor Red
        Write-Host "Use -Force flag to overwrite: .\scripts\setup-env.ps1 -Force" -ForegroundColor Yellow
        exit 1
    }
}

# Check if template exists
if (-not (Test-Path "env.template")) {
    Write-Host "${Red}❌ env.template file not found.${Reset}" -ForegroundColor Red
    Write-Host "Please ensure env.template exists in the project root." -ForegroundColor Yellow
    exit 1
}

# Copy template to .env
try {
    Copy-Item "env.template" ".env"
    Write-Host "${Green}✅ Created .env file from template${Reset}" -ForegroundColor Green
}
catch {
    Write-Host "${Red}❌ Failed to create .env file: $($_.Exception.Message)${Reset}" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "${Blue}📋 Next Steps:${Reset}" -ForegroundColor Blue
Write-Host "1. Edit .env file and replace placeholder values with your actual credentials"
Write-Host "2. For Supabase: Get your project URL and keys from your Supabase dashboard"
Write-Host "3. For API keys: Add your OpenAI and Anthropic API keys"
Write-Host "4. For security: Generate random strings for SESSION_SECRET and JWT_SECRET"
Write-Host "5. For production: Use the GitHub secrets setup script for secure deployment"
Write-Host ""

Write-Host "${Yellow}🔐 Important Security Notes:${Reset}" -ForegroundColor Yellow
Write-Host "- Never commit .env files to version control"
Write-Host "- Use GitHub secrets for production deployments"
Write-Host "- Keep your API keys secure and rotate them regularly"
Write-Host ""

Write-Host "${Green}✅ Environment setup complete!${Reset}" -ForegroundColor Green
Write-Host "You can now edit .env with your actual values and start the application." -ForegroundColor White 