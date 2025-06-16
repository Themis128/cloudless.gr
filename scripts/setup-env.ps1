# PowerShell script to generate .env file with JWT secrets
Write-Host "🔐 JWT Secret Generator & .env Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env already exists
if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "❌ Operation cancelled." -ForegroundColor Red
        exit 0
    }
}

Write-Host "🔑 Generating secure JWT secrets..." -ForegroundColor Green

# Generate secrets using Node.js
$secrets = node scripts/generate-secrets.js

# Extract the secrets from the output
$jwtSecret = ($secrets | Select-String "JWT_SECRET=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })
$jwtRefreshSecret = ($secrets | Select-String "JWT_REFRESH_SECRET=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })
$apiSecretKey = ($secrets | Select-String "API_SECRET_KEY=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })
$sessionSecret = ($secrets | Select-String "SESSION_SECRET=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })

# Prompt for Supabase credentials
Write-Host ""
Write-Host "📝 Please provide your Supabase credentials:" -ForegroundColor Yellow
Write-Host "(You can find these in your Supabase dashboard → Settings → API)" -ForegroundColor Gray
Write-Host ""

$supabaseUrl = Read-Host "Supabase URL (https://your-project.supabase.co)"
$supabaseAnonKey = Read-Host "Supabase Anon Key"
$supabaseServiceKey = Read-Host "Supabase Service Role Key"

# Create .env file content
$envContent = @"
# Supabase Configuration
SUPABASE_URL=$supabaseUrl
SUPABASE_ANON_KEY=$supabaseAnonKey
SUPABASE_SERVICE_ROLE_KEY=$supabaseServiceKey

# JWT Secrets (Auto-generated)
JWT_SECRET=$jwtSecret
JWT_REFRESH_SECRET=$jwtRefreshSecret
API_SECRET_KEY=$apiSecretKey
SESSION_SECRET=$sessionSecret

# Application Configuration
NODE_ENV=development
PORT=3000
"@

# Write to .env file
$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host ""
Write-Host "✅ .env file created successfully!" -ForegroundColor Green
Write-Host "🔒 JWT secrets have been auto-generated and saved securely." -ForegroundColor Green
Write-Host ""
Write-Host "🚀 You can now run the admin setup:" -ForegroundColor Cyan
Write-Host "   node scripts/add-admin.js" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Keep your .env file secure and never commit it to version control!" -ForegroundColor Yellow
