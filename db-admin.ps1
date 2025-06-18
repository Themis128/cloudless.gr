# Supabase Database Administration Management Script
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("start", "stop", "restart", "status", "sync", "backup", "logs")]
    [string]$Action,

    [ValidateSet("pgadmin", "dbeaver", "both")]
    [string]$Service = "pgadmin",

    [switch]$IncludeAuth,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }

function Start-DatabaseAdmin {
    param($ServiceType)

    Write-Info "Starting $ServiceType database administration..."

    switch ($ServiceType) {
        "pgadmin" {
            docker-compose -f docker-compose.admin.yml up -d
            Write-Success "pgAdmin started at http://localhost:8080"
            Write-Info "Login: admin@cloudless.gr / admin123"
        }
        "dbeaver" {
            docker-compose -f docker-compose.dbeaver.yml up -d
            Write-Success "DBeaver CloudBeaver started at http://localhost:8081"
            Write-Info "Initial setup required on first visit"
        }
        "both" {
            docker-compose -f docker-compose.admin.yml up -d
            docker-compose -f docker-compose.dbeaver.yml up -d
            Write-Success "Both services started!"
            Write-Info "pgAdmin: http://localhost:8080 (admin@cloudless.gr / admin123)"
            Write-Info "DBeaver: http://localhost:8081"
        }
    }
}

function Stop-DatabaseAdmin {
    param($ServiceType)

    Write-Info "Stopping $ServiceType database administration..."

    switch ($ServiceType) {
        "pgadmin" {
            docker-compose -f docker-compose.admin.yml down
        }
        "dbeaver" {
            docker-compose -f docker-compose.dbeaver.yml down
        }
        "both" {
            docker-compose -f docker-compose.admin.yml down
            docker-compose -f docker-compose.dbeaver.yml down
        }
    }
    Write-Success "$ServiceType stopped"
}

function Get-ServiceStatus {
    Write-Info "Database Administration Service Status:"
    Write-Host ""

    # Check pgAdmin
    $pgadminStatus = docker ps --filter "name=supabase-pgadmin" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    if ($pgadminStatus -match "supabase-pgadmin") {
        Write-Host "🟢 pgAdmin: Running" -ForegroundColor Green
        Write-Host "   URL: http://localhost:8080"
    }
    else {
        Write-Host "🔴 pgAdmin: Stopped" -ForegroundColor Red
    }

    # Check DBeaver
    $dbeaverStatus = docker ps --filter "name=supabase-dbeaver" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    if ($dbeaverStatus -match "supabase-dbeaver") {
        Write-Host "🟢 DBeaver: Running" -ForegroundColor Green
        Write-Host "   URL: http://localhost:8081"
    }
    else {
        Write-Host "🔴 DBeaver: Stopped" -ForegroundColor Red
    }

    # Check Sync Scheduler
    $syncStatus = docker ps --filter "name=supabase-sync-scheduler" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    if ($syncStatus -match "supabase-sync-scheduler") {
        Write-Host "🟢 Sync Scheduler: Running" -ForegroundColor Green
        Write-Host "   Next sync: Every 6 hours"
    }
    else {
        Write-Host "🔴 Sync Scheduler: Stopped" -ForegroundColor Red
    }

    Write-Host ""
    Write-Info "Local Supabase Status:"
    $supabaseStatus = docker ps --filter "name=supabase" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    if ($supabaseStatus) {
        Write-Host $supabaseStatus
    }
    else {
        Write-Warning "No Supabase containers running"
    }
}

function Invoke-ManualSync {
    Write-Info "Triggering manual sync..."

    $syncArgs = @()
    if ($IncludeAuth) {
        $syncArgs += "--auth"
        Write-Info "Including auth users in sync"
    }

    try {
        if (docker ps --filter "name=supabase-sync-scheduler" --format "{{.Names}}" | Where-Object { $_ -eq "supabase-sync-scheduler" }) {
            $command = "/scripts/manual-sync.sh " + ($syncArgs -join " ")
            docker exec supabase-sync-scheduler bash -c $command
            Write-Success "Manual sync completed!"
        }
        else {
            Write-Warning "Sync scheduler not running. Starting it first..."
            docker-compose -f docker-compose.dbeaver.yml up -d sync-scheduler
            Start-Sleep 5
            $command = "/scripts/manual-sync.sh " + ($syncArgs -join " ")
            docker exec supabase-sync-scheduler bash -c $command
            Write-Success "Manual sync completed!"
        }
    }
    catch {
        Write-Error "Sync failed: $($_.Exception.Message)"
        Write-Info "You can also use the PowerShell sync script: ./sync-comprehensive.ps1"
    }
}

function Invoke-Backup {
    Write-Info "Creating database backup..."

    try {
        $backupName = "manual_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
        docker exec supabase-db pg_dump -U postgres -d postgres > "db-backups/$backupName"
        Write-Success "Backup created: db-backups/$backupName"
    }
    catch {
        Write-Error "Backup failed: $($_.Exception.Message)"
    }
}

function Show-Logs {
    Write-Info "Showing recent logs..."

    Write-Host "=== Sync Logs ===" -ForegroundColor Yellow
    if (Test-Path "logs/sync.log") {
        Get-Content "logs/sync.log" -Tail 20
    }
    else {
        Write-Warning "No sync logs found"
    }

    Write-Host "`n=== Container Logs ===" -ForegroundColor Yellow
    if (docker ps --filter "name=supabase-sync-scheduler" --format "{{.Names}}" | Where-Object { $_ -eq "supabase-sync-scheduler" }) {
        docker logs --tail 10 supabase-sync-scheduler
    }
    else {
        Write-Warning "Sync scheduler not running"
    }
}

# Main execution
switch ($Action) {
    "start" { Start-DatabaseAdmin -ServiceType $Service }
    "stop" { Stop-DatabaseAdmin -ServiceType $Service }
    "restart" {
        Stop-DatabaseAdmin -ServiceType $Service
        Start-Sleep 2
        Start-DatabaseAdmin -ServiceType $Service
    }
    "status" { Get-ServiceStatus }
    "sync" { Invoke-ManualSync }
    "backup" { Invoke-Backup }
    "logs" { Show-Logs }
}

Write-Host ""
Write-Info "Database Admin Management Commands:"
Write-Host "  ./db-admin.ps1 start [pgadmin|dbeaver|both]  - Start database admin services"
Write-Host "  ./db-admin.ps1 stop [pgadmin|dbeaver|both]   - Stop database admin services"
Write-Host "  ./db-admin.ps1 status                        - Show service status"
Write-Host "  ./db-admin.ps1 sync [-IncludeAuth]           - Manual sync from cloud"
Write-Host "  ./db-admin.ps1 backup                        - Create database backup"
Write-Host "  ./db-admin.ps1 logs                          - Show recent logs"
