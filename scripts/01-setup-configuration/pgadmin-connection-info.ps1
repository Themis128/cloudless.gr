# Quick Reference - pgAdmin Connection Information
# This script shows all the connection details for pgAdmin servers

Write-Host "🔧 pgAdmin Server Connection Information" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Gray
Write-Host ""

Write-Host "🌐 pgAdmin Web Access:" -ForegroundColor Yellow
Write-Host "   URL: http://localhost:8080" -ForegroundColor Green
Write-Host "   Email: admin@cloudless.gr" -ForegroundColor Green
Write-Host "   Password: admin123" -ForegroundColor Green
Write-Host ""

Write-Host "🏠 Local Supabase Server (✅ WORKING - Green Theme):" -ForegroundColor Green
Write-Host "   Name: Local Supabase (Recommended)" -ForegroundColor White
Write-Host "   Host: supabase-db" -ForegroundColor White
Write-Host "   Port: 5432" -ForegroundColor White
Write-Host "   Database: postgres" -ForegroundColor White
Write-Host "   Username: postgres" -ForegroundColor White
Write-Host "   Password: your-super-secret-and-long-postgres-password" -ForegroundColor White
Write-Host "   Status: ✅ Available for development" -ForegroundColor Green
Write-Host "   Connection: postgresql://postgres:postgres@localhost:5432/postgres" -ForegroundColor Gray
Write-Host ""

Write-Host "☁️  Cloud Supabase Server (❌ IPv6 ISSUES - Pink Theme):" -ForegroundColor Red
Write-Host "   Name: Cloud Supabase (IPv6 Issues)" -ForegroundColor White
Write-Host "   Host: db.oflctqligzouzshimuqh.supabase.co" -ForegroundColor White
Write-Host "   Port: 5432" -ForegroundColor White
Write-Host "   Database: postgres" -ForegroundColor White
Write-Host "   Username: postgres" -ForegroundColor White
Write-Host "   Password: supabase2025" -ForegroundColor White
Write-Host "   Status: ❌ IPv6 connectivity issues" -ForegroundColor Red
Write-Host "   Connection: postgresql://postgres:supabase2025@db.oflctqligzouzshimuqh.supabase.co:5432/postgres" -ForegroundColor Gray
Write-Host ""

Write-Host "📝 Available SQL Scripts in pgAdmin:" -ForegroundColor Yellow
Write-Host "   📊 database-overview.sql - Complete database health check" -ForegroundColor Gray
Write-Host "   🔍 schema-comparison.sql - Compare schemas between local and cloud" -ForegroundColor Gray
Write-Host "   ✅ data-verification.sql - Verify data sync status" -ForegroundColor Gray
Write-Host ""

Write-Host "🔄 Management Commands:" -ForegroundColor Yellow
Write-Host "   Restart pgAdmin: docker-compose -f docker-compose.admin.yml restart" -ForegroundColor Gray
Write-Host "   View logs: docker logs supabase-pgadmin" -ForegroundColor Gray
Write-Host "   Load servers: docker exec supabase-pgadmin /venv/bin/python /pgadmin4/setup.py load-servers /pgadmin4/servers.json --user admin@cloudless.gr" -ForegroundColor Gray
Write-Host "   Test DNS: docker exec supabase-pgadmin nslookup db.oflctqligzouzshimuqh.supabase.co" -ForegroundColor Gray
Write-Host ""

Write-Host "🔧 Network Configuration:" -ForegroundColor Yellow
Write-Host "   • Both containers on same network: supabase_default" -ForegroundColor Gray
Write-Host "   • Custom DNS servers: 8.8.8.8, 1.1.1.1 (for cloud hostname resolution)" -ForegroundColor Gray
Write-Host "   • Local hostname resolution: supabase-db -> 172.20.0.x" -ForegroundColor Gray
Write-Host ""

Write-Host "💡 Tips:" -ForegroundColor Cyan
Write-Host "   • Servers are automatically configured with passwords (SavePassword: true)" -ForegroundColor Gray
Write-Host "   • Green theme = Local development database" -ForegroundColor Gray
Write-Host "   • Red theme = Cloud production database" -ForegroundColor Gray
Write-Host "   • Use SQL scripts in the Query Tool for common operations" -ForegroundColor Gray
Write-Host "   • If 'Name does not resolve' error: restart with docker-compose -f docker-compose.admin.yml restart" -ForegroundColor Gray
Write-Host "   • If 'definition of service not found' error: servers.json has been cleaned of problematic fields" -ForegroundColor Gray
Write-Host ""
