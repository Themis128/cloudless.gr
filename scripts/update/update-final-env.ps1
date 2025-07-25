#!/usr/bin/env pwsh

# Update Final Environment Variables
# This script updates the .env file with the correct JWT secret

param(
    [string]$JwtSecret = "fFuZ/huQ7HWBljbNmp6gOqrrR26exB6qb13o0gu69kYVyuXjFjlNdlrbgzXZqf6EI+RRFFzU4hwnbmxHq6lACw=="
)

# Colors for output
$Green = "`e[32m"
$Red = "`e[31m"
$Blue = "`e[34m"
$Reset = "`e[0m"

Write-Host "${Blue}🔧 Updating Final Environment Variables${Reset}" -ForegroundColor Blue
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "${Red}❌ .env file not found.${Reset}" -ForegroundColor Red
    Write-Host "Please run .\scripts\setup-env.ps1 first." -ForegroundColor Yellow
    exit 1
}

# Read the current .env file
$envContent = Get-Content ".env" -Raw

# Update JWT secret
$envContent = $envContent -replace "JWT_SECRET=JxY\*!?n23v4Dh\.;_=I6B>1t-la98\+K\]&XVmr0d@{Abs#gf,\$}Q~\)zZCMP\^oqG\\NpTR/i\|ku`:L\[<\(\`"U5Ow'E%jcFSW7eHy", "JWT_SECRET=$JwtSecret"

# Write the updated content back to .env
try {
    $envContent | Set-Content ".env" -NoNewline
    Write-Host "${Green}✅ Updated .env file with correct credentials${Reset}" -ForegroundColor Green
}
catch {
    Write-Host "${Red}❌ Failed to update .env file: $($_.Exception.Message)${Reset}" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "${Blue}📋 Updated Variables:${Reset}" -ForegroundColor Blue
Write-Host "JWT_SECRET=$($JwtSecret.Substring(0,20))..." -ForegroundColor White
Write-Host ""

Write-Host "${Green}✅ Final environment setup complete!${Reset}" -ForegroundColor Green
Write-Host "Your application now has the correct JWT secret for authentication." -ForegroundColor White
Write-Host "The development server should now be able to handle authentication properly." -ForegroundColor White
