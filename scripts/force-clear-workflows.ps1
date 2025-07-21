#!/usr/bin/env pwsh

Write-Host "🔧 Force Clear Stuck GitHub Actions Workflows" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

Write-Host "🔍 Problem:" -ForegroundColor Cyan
Write-Host "Old workflows are stuck in 'Queued' status and can't be cancelled normally." -ForegroundColor Yellow
Write-Host ""

Write-Host "💡 Solutions:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣ Method 1: GitHub CLI (Recommended)" -ForegroundColor Green
Write-Host "   If you have GitHub CLI installed:" -ForegroundColor Yellow
Write-Host "   gh run list --limit 20" -ForegroundColor Blue
Write-Host "   gh run cancel <run-id>" -ForegroundColor Blue
Write-Host ""

Write-Host "2️⃣ Method 2: Force New Workflow" -ForegroundColor Green
Write-Host "   Create a new commit to trigger only the active workflow:" -ForegroundColor Yellow
Write-Host "   git commit --allow-empty -m 'Force clear stuck workflows'" -ForegroundColor Blue
Write-Host "   git push" -ForegroundColor Blue
Write-Host ""

Write-Host "3️⃣ Method 3: Restart Runner" -ForegroundColor Green
Write-Host "   Restart your native runner to clear the queue:" -ForegroundColor Yellow
Write-Host "   .\scripts\start-runner.ps1 restart" -ForegroundColor Blue
Write-Host ""

Write-Host "4️⃣ Method 4: Manual GitHub Actions" -ForegroundColor Green
Write-Host "   Go to: https://github.com/Themis128/cloudless.gr/actions" -ForegroundColor Blue
Write-Host "   Try to cancel each stuck workflow manually" -ForegroundColor Yellow
Write-Host ""

Write-Host "🚀 Quick Fix - Let's try Method 2:" -ForegroundColor Cyan
Write-Host "   Creating a new commit to force trigger the latest workflow..." -ForegroundColor Yellow
Write-Host ""

# Try to create a new commit to force trigger the workflow
try {
    Write-Host "📝 Creating force commit..." -ForegroundColor Green
    git commit --allow-empty -m "Force clear stuck workflows - trigger latest"
    Write-Host "✅ Commit created successfully" -ForegroundColor Green
    
    Write-Host "🚀 Pushing to trigger workflow..." -ForegroundColor Green
    git push
    Write-Host "✅ Push completed" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🎉 Success! Your latest workflow should now be triggered." -ForegroundColor Green
    Write-Host "   Check: https://github.com/Themis128/cloudless.gr/actions" -ForegroundColor Blue
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Try Method 3 - Restart the runner:" -ForegroundColor Yellow
    Write-Host "   .\scripts\start-runner.ps1 restart" -ForegroundColor Blue
}

Write-Host ""
Write-Host "📊 Monitor Progress:" -ForegroundColor Cyan
Write-Host "   • GitHub Actions: https://github.com/Themis128/cloudless.gr/actions" -ForegroundColor Blue
Write-Host "   • Runner Status: .\scripts\start-runner.ps1 status" -ForegroundColor Blue
Write-Host ""
Write-Host "🎯 Expected Result:" -ForegroundColor Green
Write-Host "   • Latest workflow starts with all fixes applied" -ForegroundColor Yellow
Write-Host "   • Native runner provides unlimited CI/CD" -ForegroundColor Yellow
Write-Host "   • No more monthly limits or queuing issues" -ForegroundColor Yellow 