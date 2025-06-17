#!/usr/bin/env pwsh
# Script to check differences between local and cloud databases
# Usage: .\check-diff.ps1

Write-Host "🔍 Checking differences between local and cloud databases..." -ForegroundColor Cyan

# Check migration status
Write-Host "`n📋 Migration status:" -ForegroundColor Yellow
supabase migration list

Write-Host "`n🔄 Checking schema differences..." -ForegroundColor Yellow
try {
    # Generate diff
    $diffOutput = supabase db diff 2>&1
    
    if ($diffOutput -match "No schema changes found") {
        Write-Host "✅ Local and cloud databases are in sync!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Differences found:" -ForegroundColor Yellow
        Write-Host $diffOutput -ForegroundColor White
        
        Write-Host "`n💡 To sync these changes to cloud:" -ForegroundColor Cyan
        Write-Host "   1. Review the differences above" -ForegroundColor White
        Write-Host "   2. Run: .\scripts\sync-to-cloud.ps1" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Failed to check differences: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Make sure both local and cloud databases are accessible" -ForegroundColor Yellow
}
