#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Supabase Local Studio Access Helper
.DESCRIPTION
    Provides information and shortcuts to access your local Supabase studio
#>

Write-Host "🚀 Supabase Local Studio Access Helper" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check if local Supabase is running
Write-Host "`n🔍 Checking local Supabase status..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Local Supabase is running!" -ForegroundColor Green
} catch {
    Write-Host "❌ Local Supabase is not running or not accessible" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n📋 Your Supabase Configuration:" -ForegroundColor Yellow
Write-Host "   Studio URL: http://127.0.0.1:8000" -ForegroundColor White
Write-Host "   API URL: http://127.0.0.1:8000" -ForegroundColor White
Write-Host "   Database: localhost:5432" -ForegroundColor White

Write-Host "`n🌐 Access Points:" -ForegroundColor Yellow
Write-Host "   📊 Supabase Studio Dashboard: http://localhost:8000" -ForegroundColor Cyan
Write-Host "   📝 SQL Editor: http://localhost:8000/project/default/sql" -ForegroundColor Cyan
Write-Host "   👥 Auth Users: http://localhost:8000/project/default/auth/users" -ForegroundColor Cyan
Write-Host "   🗄️  Database Tables: http://localhost:8000/project/default/editor" -ForegroundColor Cyan

Write-Host "`n🔧 Quick Actions:" -ForegroundColor Yellow
Write-Host "   1. Open Studio Dashboard" -ForegroundColor White
Write-Host "   2. Run Database Setup SQL" -ForegroundColor White
Write-Host "   3. Check Auth Users" -ForegroundColor White
Write-Host "   4. Exit" -ForegroundColor White

do {
    $choice = Read-Host "`nEnter your choice (1-4)"
    
    switch ($choice) {
        "1" {
            Write-Host "🌐 Opening Supabase Studio Dashboard..." -ForegroundColor Green
            Start-Process "http://localhost:8000"
        }
        "2" {
            Write-Host "📝 Opening SQL Editor for database setup..." -ForegroundColor Green
            Start-Process "http://localhost:8000/project/default/sql"
            Write-Host "`n💡 Copy and paste the SQL from 'scripts/setup-database.sql'" -ForegroundColor Yellow
            Write-Host "   Or run: Get-Content scripts/setup-database.sql | Set-Clipboard" -ForegroundColor White
        }
        "3" {
            Write-Host "👥 Opening Auth Users page..." -ForegroundColor Green
            Start-Process "http://localhost:8000/project/default/auth/users"
            Write-Host "`n🔍 Look for user: baltzakis.themis@gmail.com" -ForegroundColor Yellow
        }
        "4" {
            Write-Host "👋 Goodbye!" -ForegroundColor Green
            break
        }
        default {
            Write-Host "❌ Invalid choice. Please enter 1-4." -ForegroundColor Red
        }
    }
} while ($choice -ne "4")

Write-Host "`n📚 Documentation:" -ForegroundColor Yellow
Write-Host "   Local Supabase docs: https://supabase.com/docs/guides/cli/local-development" -ForegroundColor White
Write-Host "   Setup guide: See AUTH_SYSTEM_RECOVERY.md" -ForegroundColor White

Write-Host "`n🎯 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Access Studio at: http://localhost:8000" -ForegroundColor White
Write-Host "   2. Go to SQL Editor" -ForegroundColor White
Write-Host "   3. Run the setup-database.sql script" -ForegroundColor White
Write-Host "   4. Test user login at your app" -ForegroundColor White
