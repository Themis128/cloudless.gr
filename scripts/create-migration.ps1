#!/usr/bin/env pwsh
# Script to create a new migration and optionally sync to cloud
# Usage: .\create-migration.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$MigrationName,
    
    [switch]$SyncToCloud
)

Write-Host "🔧 Creating new migration: $MigrationName" -ForegroundColor Cyan

# Create new migration
Write-Host "📝 Generating migration file..." -ForegroundColor Yellow
try {
    supabase migration new $MigrationName
    Write-Host "✅ Migration file created successfully!" -ForegroundColor Green
    
    # List recent migrations
    Write-Host "`n📋 Recent migrations:" -ForegroundColor Yellow
    Get-ChildItem "supabase/migrations" | Sort-Object Name -Descending | Select-Object -First 5 | ForEach-Object {
        Write-Host "  📄 $($_.Name)" -ForegroundColor White
    }
    
    Write-Host "`n💡 Edit your migration file in: supabase/migrations/" -ForegroundColor Yellow
    Write-Host "💡 Then run 'supabase db reset --local' to apply locally" -ForegroundColor Yellow
    
    if ($SyncToCloud) {
        Write-Host "`n🔄 Auto-syncing to cloud (as requested)..." -ForegroundColor Cyan
        & ".\scripts\sync-to-cloud.ps1"
    } else {
        Write-Host "`n💡 To sync to cloud later, run: .\scripts\sync-to-cloud.ps1" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Failed to create migration: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
