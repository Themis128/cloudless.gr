# PowerShell script to seed the database after Supabase reset
# Usage: .\scripts\seed-after-reset.ps1

param(
    [switch]$VerifyOnly,
    [switch]$Force
)

Write-Host "🌱 Supabase Database Seeding Script" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Check if Supabase containers are running
Write-Host "🔍 Checking Supabase container status..." -ForegroundColor Cyan
$dbContainer = docker ps --filter "name=supabase_db_docker" --format "{{.Status}}"

if (-not $dbContainer -or $dbContainer -notmatch "Up") {
    Write-Host "❌ Supabase database container is not running!" -ForegroundColor Red
    Write-Host "Please start Supabase first:" -ForegroundColor Yellow
    Write-Host "  cd docker && docker compose up -d" -ForegroundColor White
    exit 1
}

Write-Host "✅ Database container is running" -ForegroundColor Green

# Wait a moment for containers to be fully ready
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

if ($VerifyOnly) {
    Write-Host "🔍 Verifying existing seeded data only..." -ForegroundColor Cyan
    node scripts/seed-database.js --verify-only
    exit 0
}

# Check if we should proceed with seeding
if (-not $Force) {
    Write-Host "⚠️  This will create multiple test users in your database." -ForegroundColor Yellow
    Write-Host "🔑 Default passwords will be set for all users." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Users that will be created:" -ForegroundColor White
    Write-Host "  🛡️  baltzakis.themis@gmail.com (admin) - Your main account" -ForegroundColor Green
    Write-Host "  🛡️  john.doe@example.com (admin) - Test admin" -ForegroundColor Blue  
    Write-Host "  🛡️  mike.admin@example.com (admin) - Secondary admin" -ForegroundColor Blue
    Write-Host "  🛂 jane.smith@example.com (moderator) - Test moderator" -ForegroundColor Magenta
    Write-Host "  👤 bob.wilson@example.com (user) - Test user" -ForegroundColor Gray
    Write-Host "  👤 alice.johnson@example.com (user) - Test user" -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "Do you want to proceed? (y/N)"
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Host "❌ Seeding cancelled by user" -ForegroundColor Red
        exit 0
    }
}

# Run the seeding
Write-Host "🚀 Starting database seeding..." -ForegroundColor Green
Write-Host ""

try {
    node scripts/seed-database.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎉 Database seeding completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🔧 Quick verification:" -ForegroundColor Cyan
        docker exec -i supabase_db_docker psql -U postgres -d postgres -c "SELECT role, COUNT(*) as count FROM public.profiles GROUP BY role ORDER BY role;"
        
        Write-Host ""
        Write-Host "🌐 Next steps:" -ForegroundColor Yellow
        Write-Host "  • Open Supabase Studio: http://localhost:54323" -ForegroundColor White
        Write-Host "  • Test login with any of the seeded users" -ForegroundColor White
        Write-Host "  • Check the USER_MANAGEMENT.md for more details" -ForegroundColor White
    } else {
        Write-Host "❌ Seeding failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error during seeding: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
