# PowerShell script to add Themistoklis as Regular User
# Usage: .\scripts\add-themis-user.ps1

Write-Host "🔧 Adding Themistoklis Baltzakis as Regular User..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Check if Node.js script exists
if (Test-Path "scripts\add-themis-as-user.js") {
    Write-Host "🚀 Running Node.js script..." -ForegroundColor Green
    node scripts\add-themis-as-user.js
} else {
    Write-Host "❌ Node.js script not found. Trying SQL approach..." -ForegroundColor Yellow
    
    # Check if Docker container is running
    $containerStatus = docker ps --filter "name=supabase_db_docker" --format "{{.Status}}"
    
    if ($containerStatus -match "Up") {
        Write-Host "🐳 Running SQL script via Docker..." -ForegroundColor Green
        docker exec -i supabase_db_docker psql -U postgres -d postgres -f /scripts/add-themis-user.sql
    } else {
        Write-Host "❌ Supabase database container is not running." -ForegroundColor Red
        Write-Host "Please start your Supabase containers first:" -ForegroundColor Yellow
        Write-Host "  cd docker && docker compose up -d" -ForegroundColor White
    }
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
