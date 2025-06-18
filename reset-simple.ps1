#!/usr/bin/env pwsh
# Simple Supabase Reset Script - IPv6 Compatible
# Quick reset for local development environment

param(
    [switch]$Quick,
    [switch]$NoSeed,
    [switch]$Force
)

Write-Host "Reset Supabase - IPv6 Compatible" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Gray
Write-Host ""

if (-not $Force) {
    Write-Host "WARNING: This will reset your local Supabase environment!" -ForegroundColor Yellow
    $confirm = Read-Host "Continue? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Cancelled" -ForegroundColor Red
        exit 0
    }
}

Write-Host ""
Write-Host "Stopping services..." -ForegroundColor Yellow

# Stop services
Push-Location "docker"
docker-compose down -v --remove-orphans
docker-compose -f ../docker-compose.admin.yml down -v --remove-orphans 2>$null
Pop-Location

if (-not $Quick) {
    Write-Host "Cleaning volumes..." -ForegroundColor Yellow

    # Clean volumes
    $dirs = @("docker/volumes/db/data", "pgadmin-config/sessions")
    foreach ($dir in $dirs) {
        if (Test-Path $dir) {
            Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
        }
    }

    docker volume prune -f 2>$null
}

Write-Host "Configuring for local development..." -ForegroundColor Yellow

# Create .env file for local development
@"
# Local Development Configuration - IPv6 Compatible
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZn7aIQlFSXfRCVAUl9k6PeNmCkaDTKHTH98

# Application Config
NUXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
PORT=3000

# Security Keys
JWT_SECRET=eOvlpJPRGfQkptMLRFSfCPerPR5MkrekkpIuLqXd
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
API_SECRET_KEY=your_api_secret_key_here
SESSION_SECRET=your_session_secret_here
"@ | Set-Content ".env"

Write-Host "Starting services..." -ForegroundColor Yellow

# Start services
Push-Location "docker"
docker-compose up -d
$startResult = $LASTEXITCODE
Pop-Location

if ($startResult -eq 0) {
    Write-Host "Main services started" -ForegroundColor Green

    # Start pgAdmin
    docker-compose -f docker-compose.admin.yml up -d 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "pgAdmin started" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Waiting for services..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10

    # Update pgAdmin servers
    if (Test-Path "update-pgadmin-servers.ps1") {
        try {
            & "./update-pgadmin-servers.ps1"
            Write-Host "pgAdmin servers updated" -ForegroundColor Green
        }
        catch {
            Write-Host "pgAdmin update failed" -ForegroundColor Yellow
        }
    }

    # Seed database
    if (-not $NoSeed -and (Test-Path "scripts/07-seed-database.js")) {
        Write-Host "Seeding database..." -ForegroundColor Yellow
        try {
            node scripts/07-seed-database.js
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Database seeded" -ForegroundColor Green
            }
            else {
                Write-Host "Seeding failed" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "Seeding error" -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Write-Host "Reset Complete!" -ForegroundColor Green
    Write-Host "===============" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Access Points:" -ForegroundColor Cyan
    Write-Host "• Supabase Studio: http://127.0.0.1:54323" -ForegroundColor White
    Write-Host "• Supabase API: http://127.0.0.1:8000" -ForegroundColor White
    Write-Host "• pgAdmin: http://localhost:8080" -ForegroundColor White
    Write-Host "  - Email: admin@cloudless.gr" -ForegroundColor Gray
    Write-Host "  - Password: admin123" -ForegroundColor Gray
    Write-Host ""
    Write-Host "IPv6 issues resolved - using local development!" -ForegroundColor Yellow

}
else {
    Write-Host "Failed to start services" -ForegroundColor Red
    exit 1
}
