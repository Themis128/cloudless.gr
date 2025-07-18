# GitHub Secrets Setup Script
# This script helps set up GitHub secrets for the CI workflow

param(
    [string]$SupabaseUrl,
    [string]$SupabaseAnonKey,
    [string]$Repo = "cloudless.gr"
)

Write-Host "🔐 GitHub Secrets Setup Script" -ForegroundColor Blue
Write-Host "=================================" -ForegroundColor Blue

# Check if GitHub CLI is available
try {
    $ghVersion = gh --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ GitHub CLI is available" -ForegroundColor Green
    }
    else {
        throw "GitHub CLI not found"
    }
}
catch {
    Write-Host "❌ GitHub CLI not found or not working" -ForegroundColor Red
    Write-Host "Please install GitHub CLI first:" -ForegroundColor Yellow
    Write-Host "  winget install --id GitHub.cli" -ForegroundColor Yellow
    Write-Host "  OR" -ForegroundColor Yellow
    Write-Host "  choco install gh" -ForegroundColor Yellow
    Write-Host "  OR" -ForegroundColor Yellow
    Write-Host "  Download from: https://cli.github.com/" -ForegroundColor Yellow
    exit 1
}

# Check if user is authenticated
try {
    $authStatus = gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Not authenticated with GitHub CLI" -ForegroundColor Red
        Write-Host "Please run: gh auth login" -ForegroundColor Yellow
        exit 1
    }
    else {
        Write-Host "✅ Authenticated with GitHub CLI" -ForegroundColor Green
    }
}
catch {
    Write-Host "❌ Authentication check failed" -ForegroundColor Red
    exit 1
}

# Prompt for Supabase credentials if not provided
if (-not $SupabaseUrl) {
    $SupabaseUrl = Read-Host "Enter your Supabase URL (e.g., https://your-project.supabase.co)"
}

if (-not $SupabaseAnonKey) {
    $SupabaseAnonKey = Read-Host "Enter your Supabase Anon Key"
}

# Validate inputs
if (-not $SupabaseUrl -or -not $SupabaseAnonKey) {
    Write-Host "❌ Both Supabase URL and Anon Key are required" -ForegroundColor Red
    exit 1
}

if (-not $SupabaseUrl.StartsWith("https://")) {
    Write-Host "❌ Supabase URL must start with https://" -ForegroundColor Red
    exit 1
}

Write-Host "`n🔧 Setting up GitHub secrets..." -ForegroundColor Blue

# Set SUPABASE_URL secret
Write-Host "Setting SUPABASE_URL secret..." -ForegroundColor Yellow
try {
    gh secret set SUPABASE_URL --body $SupabaseUrl --repo $Repo
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ SUPABASE_URL secret set successfully" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Failed to set SUPABASE_URL secret" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Error setting SUPABASE_URL secret: $($_.Exception.Message)" -ForegroundColor Red
}

# Set SUPABASE_ANON_KEY secret
Write-Host "Setting SUPABASE_ANON_KEY secret..." -ForegroundColor Yellow
try {
    gh secret set SUPABASE_ANON_KEY --body $SupabaseAnonKey --repo $Repo
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ SUPABASE_ANON_KEY secret set successfully" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Failed to set SUPABASE_ANON_KEY secret" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Error setting SUPABASE_ANON_KEY secret: $($_.Exception.Message)" -ForegroundColor Red
}

# List current secrets
Write-Host "`n📋 Current repository secrets:" -ForegroundColor Blue
try {
    gh secret list --repo $Repo
}
catch {
    Write-Host "❌ Could not list secrets: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 GitHub secrets setup completed!" -ForegroundColor Green
Write-Host "You can now run your CI workflow and it should have access to the Supabase credentials." -ForegroundColor Green 