#!/usr/bin/env pwsh
# Script to switch between local and cloud database configurations
# Usage: .\switch-env.ps1 [local|cloud]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("local", "cloud")]
    [string]$Environment
)

$envFile = ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    exit 1
}

Write-Host "🔄 Switching to $Environment environment..." -ForegroundColor Cyan

# Read current .env content
$content = Get-Content $envFile

# Update content based on environment
if ($Environment -eq "local") {
    Write-Host "🏠 Configuring for LOCAL development..." -ForegroundColor Yellow
    
    # Comment out cloud settings
    $content = $content -replace '^SUPABASE_URL=https://oflctqligzouzshimuqh', '# SUPABASE_URL=https://oflctqligzouzshimuqh'
    $content = $content -replace '^SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIi', '# SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIi'
    $content = $content -replace '^SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIi', '# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIi'
    
    # Uncomment local settings
    $content = $content -replace '^# SUPABASE_URL=http://127\.0\.0\.1:8000', 'SUPABASE_URL=http://127.0.0.1:54321'
    $content = $content -replace '^# SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJyb2xlIjoiYW5vbiI', 'SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiI'
    $content = $content -replace '^# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJyb2xlIjoic2VydmljZV9yb2xlIi', 'SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIi'
    
    Write-Host "✅ Configured for LOCAL development" -ForegroundColor Green
    Write-Host "🔧 Make sure to run: supabase start" -ForegroundColor Yellow
    Write-Host "🌐 Your app will use: http://127.0.0.1:54321" -ForegroundColor White
    
} else {
    Write-Host "☁️ Configuring for CLOUD production..." -ForegroundColor Yellow
    
    # Comment out local settings
    $content = $content -replace '^SUPABASE_URL=http://127\.0\.0\.1:', '# SUPABASE_URL=http://127.0.0.1:'
    $content = $content -replace '^SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJyb2xlIjoiYW5vbiI', '# SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiI'
    $content = $content -replace '^SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJyb2xlIjoic2VydmljZV9yb2xlIi', '# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIi'
    
    # Uncomment cloud settings
    $content = $content -replace '^# SUPABASE_URL=https://oflctqligzouzshimuqh', 'SUPABASE_URL=https://oflctqligzouzshimuqh'
    $content = $content -replace '^# SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIi', 'SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIi'
    $content = $content -replace '^# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIi', 'SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIi'
    
    Write-Host "✅ Configured for CLOUD production" -ForegroundColor Green
    Write-Host "🌐 Your app will use: https://oflctqligzouzshimuqh.supabase.co" -ForegroundColor White
}

# Write updated content back to file
$content | Set-Content $envFile

Write-Host "`n🔄 Environment switched successfully!" -ForegroundColor Green
Write-Host "💡 Restart your dev server to apply changes: npm run dev" -ForegroundColor Yellow
