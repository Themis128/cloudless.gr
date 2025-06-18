# Enhanced pgAdmin Setup and Management Script

param(
    [string]$Action = "status",
    [switch]$Restart,
    [switch]$Reset,
    [switch]$Logs
)

Write-Host "🔧 pgAdmin Enhanced Configuration Manager" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Gray

function Show-Status {
    Write-Host "📊 Current Status:" -ForegroundColor Yellow
    docker ps --filter "name=supabase-pgadmin" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    if (docker ps --filter "name=supabase-pgadmin" --filter "status=running" -q) {
        Write-Host ""
        Write-Host "✅ pgAdmin is running!" -ForegroundColor Green
        Write-Host "🌐 Access pgAdmin at: http://localhost:8080" -ForegroundColor Cyan
        Write-Host "📧 Email: admin@cloudless.gr" -ForegroundColor Gray
        Write-Host "🔑 Password: admin123" -ForegroundColor Gray
        Write-Host ""
        Write-Host "📁 Pre-configured servers:" -ForegroundColor Yellow
        Write-Host "   • Local Supabase (Green theme)" -ForegroundColor Green
        Write-Host "   • Cloud Supabase (Red theme)" -ForegroundColor Red
        Write-Host ""
        Write-Host "📝 Available SQL Scripts in /sql-scripts:" -ForegroundColor Yellow
        Write-Host "   • database-overview.sql - Complete DB health check" -ForegroundColor Gray
        Write-Host "   • schema-comparison.sql - Compare schemas" -ForegroundColor Gray
        Write-Host "   • data-verification.sql - Verify sync status" -ForegroundColor Gray
    }
    else {
        Write-Host "❌ pgAdmin is not running" -ForegroundColor Red
    }
}

function Start-Services {
    Write-Host "🚀 Starting enhanced pgAdmin..." -ForegroundColor Green

    # Ensure directories exist
    if (-not (Test-Path "./db-backups")) {
        New-Item -ItemType Directory -Path "./db-backups" -Force
        Write-Host "📁 Created db-backups directory" -ForegroundColor Gray
    }

    if (-not (Test-Path "./logs")) {
        New-Item -ItemType Directory -Path "./logs" -Force
        Write-Host "📁 Created logs directory" -ForegroundColor Gray
    }

    # Start the services
    docker-compose -f docker-compose.admin.yml up -d

    # Wait for pgAdmin to be ready
    Write-Host "⏳ Waiting for pgAdmin to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    # Load servers if they aren't already loaded
    Load-Servers
}

function Load-Servers {
    Write-Host "🔧 Loading server configurations..." -ForegroundColor Yellow

    try {
        # Create admin user if it doesn't exist
        $userCheck = docker exec supabase-pgadmin /venv/bin/python /pgadmin4/setup.py get-users 2>$null | Select-String "admin@cloudless.gr"
        if (-not $userCheck) {
            Write-Host "👤 Creating admin user..." -ForegroundColor Gray
            docker exec supabase-pgadmin /venv/bin/python /pgadmin4/setup.py add-user admin@cloudless.gr admin123 --admin 2>$null | Out-Null
        }

        # Load servers for admin user
        Write-Host "📡 Loading server configurations..." -ForegroundColor Gray
        $loadResult = docker exec supabase-pgadmin /venv/bin/python /pgadmin4/setup.py load-servers /pgadmin4/servers.json --user admin@cloudless.gr 2>$null

        if ($loadResult -match "Added.*Server") {
            Write-Host "✅ Server configurations loaded successfully" -ForegroundColor Green
        }
        else {
            Write-Host "ℹ️  Server configurations already loaded" -ForegroundColor Cyan
        }
    }
    catch {
        Write-Host "⚠️  Could not load servers automatically: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "   You can load them manually from pgAdmin interface" -ForegroundColor Gray
    }
}

function Stop-Services {
    Write-Host "🛑 Stopping pgAdmin services..." -ForegroundColor Red
    docker-compose -f docker-compose.admin.yml down
}

function Restart-Services {
    Write-Host "🔄 Restarting pgAdmin with new configuration..." -ForegroundColor Yellow
    Stop-Services
    Start-Sleep -Seconds 3
    Start-Services
}

function Reset-Services {
    Write-Host "🗑️ Resetting pgAdmin (will remove all settings)..." -ForegroundColor Red
    Write-Host "⚠️  This will delete all pgAdmin data and configurations!" -ForegroundColor Yellow
    $confirm = Read-Host "Type 'yes' to confirm"

    if ($confirm -eq "yes") {
        docker-compose -f docker-compose.admin.yml down -v
        docker volume rm cloudlessgr_pgadmin_data -f
        Write-Host "✅ pgAdmin reset complete. Run with -Action start to begin fresh." -ForegroundColor Green
    }
    else {
        Write-Host "❌ Reset cancelled." -ForegroundColor Gray
    }
}

function Show-Logs {
    Write-Host "📋 pgAdmin Logs:" -ForegroundColor Yellow
    docker logs supabase-pgadmin --tail 50 -f
}

function Show-Help {
    Write-Host ""
    Write-Host "🔧 pgAdmin Enhanced Manager - Usage:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   .\pgadmin-enhanced.ps1 -Action start     # Start pgAdmin with enhanced config" -ForegroundColor White
    Write-Host "   .\pgadmin-enhanced.ps1 -Action stop      # Stop pgAdmin services" -ForegroundColor White
    Write-Host "   .\pgadmin-enhanced.ps1 -Action status    # Show current status" -ForegroundColor White
    Write-Host "   .\pgadmin-enhanced.ps1 -Restart          # Restart with new config" -ForegroundColor White
    Write-Host "   .\pgadmin-enhanced.ps1 -Reset            # Reset all data (destructive)" -ForegroundColor White
    Write-Host "   .\pgadmin-enhanced.ps1 -Logs             # View live logs" -ForegroundColor White
    Write-Host ""
    Write-Host "🌟 Enhanced Features:" -ForegroundColor Yellow
    Write-Host "   • Pre-configured server connections (Local + Cloud)" -ForegroundColor Gray
    Write-Host "   • Automatic password management" -ForegroundColor Gray
    Write-Host "   • Color-coded server themes" -ForegroundColor Gray
    Write-Host "   • Ready-to-use SQL diagnostic scripts" -ForegroundColor Gray
    Write-Host "   • Backup and sync integration" -ForegroundColor Gray
    Write-Host ""
}

# Main execution
switch ($Action.ToLower()) {
    "start" { Start-Services }
    "stop" { Stop-Services }
    "status" { Show-Status }
    "help" { Show-Help }
    default { Show-Status }
}

if ($Restart) { Restart-Services }
if ($Reset) { Reset-Services }
if ($Logs) { Show-Logs }

Write-Host ""
Write-Host "💡 Tip: Use -Action help for all available commands" -ForegroundColor Cyan
