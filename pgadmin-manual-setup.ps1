# Manual pgAdmin Server Setup Guide
# Use this script to manually add servers to pgAdmin to avoid the "service definition" error

Write-Host "🔧 Manual pgAdmin Server Setup" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Gray
Write-Host ""

Write-Host "🌐 Access pgAdmin at: http://localhost:8080" -ForegroundColor Yellow
Write-Host "📧 Email: admin@cloudless.gr" -ForegroundColor Green
Write-Host "🔑 Password: admin123" -ForegroundColor Green
Write-Host ""

Write-Host "🏠 To add LOCAL SUPABASE server:" -ForegroundColor Green
Write-Host "1. Right-click 'Servers' in left panel → 'Create' → 'Server...'" -ForegroundColor White
Write-Host "2. General Tab:" -ForegroundColor Yellow
Write-Host "   Name: Local Supabase" -ForegroundColor Gray
Write-Host "3. Connection Tab:" -ForegroundColor Yellow
Write-Host "   Host: supabase-db" -ForegroundColor Gray
Write-Host "   Port: 5432" -ForegroundColor Gray
Write-Host "   Maintenance database: postgres" -ForegroundColor Gray
Write-Host "   Username: postgres" -ForegroundColor Gray
Write-Host "   Password: postgres" -ForegroundColor Gray
Write-Host "   ✅ Check 'Save password'" -ForegroundColor Cyan
Write-Host "4. Click 'Save'" -ForegroundColor White
Write-Host ""

Write-Host "☁️  To add CLOUD SUPABASE server:" -ForegroundColor Red
Write-Host "1. Right-click 'Servers' in left panel → 'Create' → 'Server...'" -ForegroundColor White
Write-Host "2. General Tab:" -ForegroundColor Yellow
Write-Host "   Name: Cloud Supabase" -ForegroundColor Gray
Write-Host "3. Connection Tab:" -ForegroundColor Yellow
Write-Host "   Host: db.oflctqligzouzshimuqh.supabase.co" -ForegroundColor Gray
Write-Host "   Port: 5432" -ForegroundColor Gray
Write-Host "   Maintenance database: postgres" -ForegroundColor Gray
Write-Host "   Username: postgres" -ForegroundColor Gray
Write-Host "   Password: supabase2025" -ForegroundColor Gray
Write-Host "   ✅ Check 'Save password'" -ForegroundColor Cyan
Write-Host "   SSL Mode: Require" -ForegroundColor Gray
Write-Host "4. Click 'Save'" -ForegroundColor White
Write-Host ""

Write-Host "🎨 Optional - Set server colors:" -ForegroundColor Yellow
Write-Host "1. Right-click server → 'Properties'" -ForegroundColor White
Write-Host "2. Advanced Tab:" -ForegroundColor Yellow
Write-Host "   Local: Background #1a472a, Foreground #ffffff (Green theme)" -ForegroundColor Green
Write-Host "   Cloud: Background #8b1538, Foreground #ffffff (Red theme)" -ForegroundColor Red
Write-Host ""

Write-Host "💡 Why manual setup?" -ForegroundColor Cyan
Write-Host "   • Avoids 'definition of service not found' errors" -ForegroundColor Gray
Write-Host "   • Ensures passwords are properly saved" -ForegroundColor Gray
Write-Host "   • More reliable than JSON import" -ForegroundColor Gray
Write-Host ""

Write-Host "🔄 Management Commands:" -ForegroundColor Yellow
Write-Host "   Restart pgAdmin: docker-compose -f docker-compose.admin.yml restart" -ForegroundColor Gray
Write-Host "   View logs: docker logs supabase-pgadmin" -ForegroundColor Gray
Write-Host ""
