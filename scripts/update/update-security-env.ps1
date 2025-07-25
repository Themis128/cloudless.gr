#!/usr/bin/env pwsh

# Update Security Environment Variables
# This script updates the .env file with secure session and JWT secrets

param(
    [string]$SessionSecret = "%?vY;6K*e{z-DW~Q'c_ap5[m]|jS)dy\$Fx9>ZO,2gr`EkXH&J4b`"^PBo/L0i=8u",
    [string]$JwtSecret = "JxY*!?n23v4Dh.;_=I6B>1t-la98+K]&XVmr0d@{Abs#gf,$}Q~)zZCMP^oqG\NpTR/i|ku`:L[<(`"U5Ow'E%jcFSW7eHy"
)

# Colors for output
$Green = "`e[32m"
$Red = "`e[31m"
$Blue = "`e[34m"
$Reset = "`e[0m"

Write-Host "${Blue}🔧 Updating Security Environment Variables${Reset}" -ForegroundColor Blue
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "${Red}❌ .env file not found.${Reset}" -ForegroundColor Red
    Write-Host "Please run .\scripts\setup-env.ps1 first." -ForegroundColor Yellow
    exit 1
}

# Read the current .env file
$envContent = Get-Content ".env" -Raw

# Update session secret
$envContent = $envContent -replace "SESSION_SECRET=your-session-secret-here", "SESSION_SECRET=$SessionSecret"

# Update JWT secret
$envContent = $envContent -replace "JWT_SECRET=your-jwt-secret-here", "JWT_SECRET=$JwtSecret"

# Write the updated content back to .env
try {
    $envContent | Set-Content ".env" -NoNewline
    Write-Host "${Green}✅ Updated .env file with secure secrets${Reset}" -ForegroundColor Green
}
catch {
    Write-Host "${Red}❌ Failed to update .env file: $($_.Exception.Message)${Reset}" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "${Blue}📋 Updated Variables:${Reset}" -ForegroundColor Blue
Write-Host "SESSION_SECRET=$($SessionSecret.Substring(0,20))..." -ForegroundColor White
Write-Host "JWT_SECRET=$($JwtSecret.Substring(0,20))..." -ForegroundColor White
Write-Host ""

Write-Host "${Green}✅ Security environment setup complete!${Reset}" -ForegroundColor Green
Write-Host "Your application now has secure session and JWT secrets." -ForegroundColor White 