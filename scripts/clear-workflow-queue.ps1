#!/usr/bin/env pwsh

Write-Host "🧹 GitHub Actions Workflow Queue Cleanup Guide" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

Write-Host "🔍 Current Situation:" -ForegroundColor Cyan
Write-Host "You have multiple old workflows queued that are blocking your latest workflow." -ForegroundColor Yellow
Write-Host ""

Write-Host "📋 Steps to Fix This:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣ Go to GitHub Actions:" -ForegroundColor Green
Write-Host "   https://github.com/Themis128/cloudless.gr/actions" -ForegroundColor Blue
Write-Host ""

Write-Host "2️⃣ Cancel Old Workflows:" -ForegroundColor Green
Write-Host "   • Find workflows #1-7 (the old ones)" -ForegroundColor Yellow
Write-Host "   • Click the '⋮' menu (three dots) next to each" -ForegroundColor Yellow
Write-Host "   • Select 'Cancel workflow'" -ForegroundColor Yellow
Write-Host ""

Write-Host "3️⃣ Let Latest Workflow Run:" -ForegroundColor Green
Write-Host "   • Your latest workflow (#9) should now start automatically" -ForegroundColor Yellow
Write-Host "   • It will use the native runner with all our fixes" -ForegroundColor Yellow
Write-Host ""

Write-Host "🎯 Why This Happened:" -ForegroundColor Cyan
Write-Host "   • Old workflows were queued before we disabled them" -ForegroundColor Yellow
Write-Host "   • GitHub Actions processes queues in order" -ForegroundColor Yellow
Write-Host "   • Only one workflow can run at a time on your runner" -ForegroundColor Yellow
Write-Host ""

Write-Host "✅ After Cleanup:" -ForegroundColor Green
Write-Host "   • Only the native-runner-optimized.yml workflow is active" -ForegroundColor Yellow
Write-Host "   • All PATH, cache, and syntax issues are fixed" -ForegroundColor Yellow
Write-Host "   • Your native runner will provide unlimited CI/CD" -ForegroundColor Yellow
Write-Host ""

Write-Host "🚀 Quick Links:" -ForegroundColor Cyan
Write-Host "   • GitHub Actions: https://github.com/Themis128/cloudless.gr/actions" -ForegroundColor Blue
Write-Host "   • Runner Settings: https://github.com/Themis128/cloudless.gr/settings/actions/runners" -ForegroundColor Blue
Write-Host ""

Write-Host "💡 Pro Tip:" -ForegroundColor Green
Write-Host "   After canceling the old workflows, your latest commit (2b46fdf) will trigger" -ForegroundColor Yellow
Write-Host "   the native runner workflow with all our fixes applied!" -ForegroundColor Yellow 