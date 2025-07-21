#!/usr/bin/env pwsh

Write-Host "🔐 GitHub Self-Hosted Runner Registration Token Guide" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""

Write-Host "📋 To get your registration token, follow these steps:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣ Go to your repository settings:" -ForegroundColor Yellow
Write-Host "   https://github.com/Themis128/cloudless.gr/settings/actions/runners" -ForegroundColor Cyan
Write-Host ""

Write-Host "2️⃣ Click 'New self-hosted runner'" -ForegroundColor Yellow
Write-Host ""

Write-Host "3️⃣ Choose 'Windows' as the operating system" -ForegroundColor Yellow
Write-Host ""

Write-Host "4️⃣ Copy the registration token (it starts with AEWC...)" -ForegroundColor Yellow
Write-Host "   NOT a Personal Access Token (ghp_...)" -ForegroundColor Red
Write-Host ""

Write-Host "5️⃣ Run the setup script:" -ForegroundColor Yellow
Write-Host "   .\scripts\setup-runner-with-env.ps1" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔍 Difference between tokens:" -ForegroundColor Magenta
Write-Host "   • Registration Token: AEWC... (for runner setup)" -ForegroundColor Green
Write-Host "   • Personal Access Token: ghp_... (for API access)" -ForegroundColor Red
Write-Host ""

Write-Host "💡 Tip: The registration token is only valid for 1 hour!" -ForegroundColor Yellow
Write-Host "   Generate it right before you need it." -ForegroundColor Yellow
Write-Host ""

Write-Host "🚀 Ready to get your token? Open the link above!" -ForegroundColor Green 