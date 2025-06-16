# PowerShell script to add admin user
Write-Host "🔧 Adding admin user to Supabase..." -ForegroundColor Yellow
Write-Host ""

# Check if Node.js is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found. Please create .env with Supabase credentials." -ForegroundColor Red
    Write-Host "Required variables:" -ForegroundColor Yellow
    Write-Host "  SUPABASE_URL=your_supabase_url" -ForegroundColor Gray
    Write-Host "  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key" -ForegroundColor Gray
    exit 1
}

# Install dependencies if needed
Write-Host "📦 Checking dependencies..." -ForegroundColor Blue
if (-not (Test-Path "node_modules\@supabase\supabase-js")) {
    Write-Host "Installing @supabase/supabase-js..." -ForegroundColor Yellow
    npm install @supabase/supabase-js dotenv
}

# Run the admin setup script
Write-Host "🚀 Running admin setup script..." -ForegroundColor Green
node scripts/add-admin.js

Write-Host ""
Write-Host "✨ Process completed! Check the output above for results." -ForegroundColor Cyan
