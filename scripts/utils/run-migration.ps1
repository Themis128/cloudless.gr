# Run Supabase Migration Script
# This script applies the contact_messages table migration to Supabase

Write-Host "🚀 Running Supabase Migration..." -ForegroundColor Green

# Check if Supabase CLI is installed
try {
    $supabaseVersion = supabase --version
    Write-Host "✅ Supabase CLI found: $supabaseVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Supabase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Check if we're in a Supabase project
if (-not (Test-Path "supabase/config.toml")) {
    Write-Host "❌ Not in a Supabase project directory. Please run this from your project root." -ForegroundColor Red
    exit 1
}

# Apply the migration
Write-Host "📦 Applying migration..." -ForegroundColor Yellow
try {
    supabase db push
    Write-Host "✅ Migration applied successfully!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to apply migration:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Contact messages table created successfully!" -ForegroundColor Green
Write-Host "📋 You can now use the contact form to save messages to the database." -ForegroundColor Cyan 