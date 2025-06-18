#!/usr/bin/env pwsh
# Update pgAdmin Servers Configuration
# This script reloads the server configuration in pgAdmin

Write-Host "🔄 Updating pgAdmin Server Configuration" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Gray
Write-Host ""

# Check if pgAdmin is running
$pgAdminContainer = docker ps --filter "name=pgadmin" --format "{{.Names}}" 2>$null
if (-not $pgAdminContainer) {
    Write-Host "❌ pgAdmin container not found!" -ForegroundColor Red
    Write-Host "   Start pgAdmin with: docker-compose -f docker-compose.admin.yml up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found pgAdmin container: $pgAdminContainer" -ForegroundColor Green

# Load servers configuration
Write-Host "📝 Loading server configuration from servers.json..." -ForegroundColor Yellow
try {
    $result = docker exec supabase-pgadmin /venv/bin/python /pgadmin4/setup.py load-servers /pgadmin4/servers.json --user admin@cloudless.gr 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Server configuration loaded successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Updated servers:" -ForegroundColor Cyan
        Write-Host "• Local Supabase (Recommended) - Green theme" -ForegroundColor Green
        Write-Host "• Cloud Supabase (IPv6 Issues) - Pink theme" -ForegroundColor Magenta
        Write-Host ""
        Write-Host "🌐 Access pgAdmin at: http://localhost:8080" -ForegroundColor Yellow
        Write-Host "   Email: admin@cloudless.gr" -ForegroundColor Gray
        Write-Host "   Password: admin123" -ForegroundColor Gray
    }
    else {
        Write-Host "❌ Failed to load server configuration" -ForegroundColor Red
        Write-Host "Error output: $result" -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ Error loading servers: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Cyan
Write-Host "• Use the Local Supabase server for all development work" -ForegroundColor White
Write-Host "• The Cloud server has IPv6 connectivity issues" -ForegroundColor White
Write-Host "• Servers are color-coded: Green = Working, Pink = Issues" -ForegroundColor White
