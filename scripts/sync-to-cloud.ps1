#!/usr/bin/env pwsh
# Script to sync local database changes to cloud
# Usage: .\sync-to-cloud.ps1

Write-Host "🚀 Syncing local changes to cloud database..." -ForegroundColor Cyan

# Check if we're linked to a project
Write-Host "📡 Checking Supabase project link..." -ForegroundColor Yellow
$linkStatus = supabase projects list 2>&1
if ($linkStatus -match "cloudless\.gr" -and $linkStatus -match "LINKED") {
    Write-Host "✅ Project is linked to cloud" -ForegroundColor Green
} else {
    Write-Host "❌ Project is not linked to cloud. Run 'supabase link' first" -ForegroundColor Red
    exit 1
}

# Show current migration status
Write-Host "`n📋 Current migration status:" -ForegroundColor Yellow
supabase migration list

# Ask for confirmation
$confirmation = Read-Host "`n⚠️  Do you want to push local migrations to cloud? (y/N)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "❌ Operation cancelled" -ForegroundColor Red
    exit 0
}

# Push migrations to cloud
Write-Host "`n🔄 Pushing migrations to cloud..." -ForegroundColor Cyan
try {
    # First try normal push
    $pushResult = supabase db push 2>&1
    
    # Check if we need to use --include-all flag
    if ($pushResult -match "Rerun the command with --include-all flag") {
        Write-Host "  📋 Detected out-of-order migrations, using --include-all flag..." -ForegroundColor Yellow
        supabase db push --include-all
    } elseif ($LASTEXITCODE -ne 0) {
        throw "Push failed: $pushResult"
    }
    
    Write-Host "✅ Successfully pushed migrations to cloud!" -ForegroundColor Green
    
    # Show updated status
    Write-Host "`n📋 Updated migration status:" -ForegroundColor Yellow
    supabase migration list
    
    Write-Host "`n🎉 Local changes have been synced to cloud!" -ForegroundColor Green
    Write-Host "🌐 Your cloud database is now up to date." -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed to push migrations: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Try running 'supabase db diff' to see what changes need to be applied" -ForegroundColor Yellow
    exit 1
}
