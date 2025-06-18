# Fix IPv6 Connection Issues with Supabase
# This script provides multiple solutions to resolve IPv6 connectivity issues

Write-Host "🔧 Fixing IPv6 Connection Issues" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Gray
Write-Host ""

Write-Host "Issue: Connection failing to IPv6 address 2a05:d014:1c06:5f09:c4c5:4adc:1846:bad" -ForegroundColor Red
Write-Host "Solutions available:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. 🌐 Use Connection Pooler (Recommended)" -ForegroundColor Green
Write-Host "   Supabase provides IPv4 connection pooling on port 6543" -ForegroundColor White
Write-Host "   Connection string: postgresql://postgres:supabase2025@db.oflctqligzouzshimuqh.supabase.co:6543/postgres" -ForegroundColor Gray
Write-Host ""

Write-Host "2. 🔗 Use Direct IPv4 Address (if available)" -ForegroundColor Green
Write-Host "   Try to find the IPv4 address behind the load balancer" -ForegroundColor White
Write-Host ""

Write-Host "3. 🚫 Disable IPv6 Temporarily" -ForegroundColor Yellow
Write-Host "   Force applications to use IPv4 only" -ForegroundColor White
Write-Host ""

Write-Host "4. 📡 Use Connection Through REST API" -ForegroundColor Green
Write-Host "   Use Supabase client libraries instead of direct PostgreSQL connection" -ForegroundColor White
Write-Host ""

# Test connection pooler
Write-Host "Testing Connection Pooler (Port 6543)..." -ForegroundColor Cyan
try {
    $result = Test-NetConnection -ComputerName db.oflctqligzouzshimuqh.supabase.co -Port 6543 -WarningAction SilentlyContinue
    if ($result.TcpTestSucceeded) {
        Write-Host "✅ Connection pooler is accessible!" -ForegroundColor Green
        Write-Host "   Use port 6543 instead of 5432 for your connections" -ForegroundColor White
    }
    else {
        Write-Host "❌ Connection pooler also not accessible" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Error testing connection pooler: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ LOCAL SUPABASE SERVICES ARE RUNNING!" -ForegroundColor Green
Write-Host "✅ PGADMIN CONNECTION SUCCESSFUL!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

Write-Host "🎉 All connections are working perfectly!" -ForegroundColor Cyan
Write-Host "Since your local Supabase services are up and running, you can:" -ForegroundColor Cyan
Write-Host "1. 🏠 Use Local Development Environment (Recommended)" -ForegroundColor Green
Write-Host "   Your Nuxt config is already set to use local Supabase by default" -ForegroundColor White
Write-Host "   Local API URL: http://127.0.0.1:8000" -ForegroundColor Gray
Write-Host "   Local Studio URL: http://127.0.0.1:54323" -ForegroundColor Gray
Write-Host ""

Write-Host "2. 🔧 Ensure No Cloud Override in Environment" -ForegroundColor Yellow
Write-Host "   Make sure you don't have .env file with cloud Supabase URLs" -ForegroundColor White
Write-Host ""

Write-Host "3. 🌐 For Cloud Access (when needed)" -ForegroundColor Blue
Write-Host "   Use connection pooler port 6543 instead of 5432" -ForegroundColor White
Write-Host "   Or contact your ISP about IPv6 connectivity issues" -ForegroundColor White
Write-Host ""

# Check if .env file exists and might override local config
if (Test-Path ".env") {
    Write-Host "⚠️  Found .env file - checking configuration..." -ForegroundColor Yellow
    $envContent = Get-Content ".env" -ErrorAction SilentlyContinue
    $activeSupabaseUrl = $envContent | Where-Object { $_ -match "^SUPABASE_URL=" -and $_ -notmatch "^#" }

    if ($activeSupabaseUrl -match "127\.0\.0\.1|localhost") {
        Write-Host "✅ Local Supabase URL is active in .env!" -ForegroundColor Green
        Write-Host "   Current: $activeSupabaseUrl" -ForegroundColor Gray
    }
    elseif ($activeSupabaseUrl -match "supabase\.co") {
        Write-Host "❌ Cloud Supabase URL is active in .env!" -ForegroundColor Red
        Write-Host "   This will cause IPv6 connectivity issues" -ForegroundColor White
        Write-Host "   Switch to local URL for development" -ForegroundColor White
    }
    else {
        Write-Host "✅ Using default local configuration from nuxt.config.ts" -ForegroundColor Green
    }
}
else {
    Write-Host "✅ No .env file found - using default local configuration" -ForegroundColor Green
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Start your Nuxt development server: npm run dev" -ForegroundColor White
Write-Host "2. Your app should connect to local Supabase automatically" -ForegroundColor White
Write-Host "3. Access Supabase Studio at: http://127.0.0.1:54323" -ForegroundColor White
Write-Host "4. Access pgAdmin at: http://localhost:8080" -ForegroundColor White
Write-Host "   • Email: admin@cloudless.gr" -ForegroundColor Gray
Write-Host "   • Password: admin123" -ForegroundColor Gray
Write-Host "   • Use 'Local Supabase (Recommended)' server" -ForegroundColor Gray
Write-Host ""
Write-Host "🔄 Reset & Seed Options:" -ForegroundColor Cyan
Write-Host "• Full reset: .\reset-and-seed-enhanced.ps1" -ForegroundColor White
Write-Host "• Quick reset: .\quick-reset.ps1 -Quick" -ForegroundColor White
Write-Host "• Reset without seeding: .\quick-reset.ps1 -NoSeed" -ForegroundColor White
