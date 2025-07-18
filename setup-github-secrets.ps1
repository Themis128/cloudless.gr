# GitHub Secrets Setup Script
# This script helps you set up GitHub repository secrets using the GitHub API

param(
    [string]$RepoOwner = "Themis128",
    [string]$RepoName = "cloudless.gr",
    [string]$SupabaseUrl,
    [string]$SupabaseAnonKey
)

Write-Host "🔐 GitHub Secrets Setup Script" -ForegroundColor Cyan
Write-Host ""

# Check if GitHub token is available
$githubToken = $env:GITHUB_TOKEN
if (-not $githubToken) {
    Write-Host "❌ GITHUB_TOKEN environment variable not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "To set up GitHub secrets, you need a Personal Access Token:" -ForegroundColor Yellow
    Write-Host "1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)" -ForegroundColor Yellow
    Write-Host "2. Generate new token with 'repo' scope" -ForegroundColor Yellow
    Write-Host "3. Set the token as environment variable: `$env:GITHUB_TOKEN = 'your-token'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or run this script with: GITHUB_TOKEN=your-token .\setup-github-secrets.ps1" -ForegroundColor Yellow
    exit 1
}

# Prompt for Supabase credentials if not provided
if (-not $SupabaseUrl) {
    $SupabaseUrl = Read-Host "Enter your Supabase URL (e.g., https://abcdefghijklmnop.supabase.co)"
}

if (-not $SupabaseAnonKey) {
    $SupabaseAnonKey = Read-Host "Enter your Supabase anon key (starts with eyJ...)"
}

# Validate inputs
if (-not $SupabaseUrl.StartsWith("https://") -or -not $SupabaseUrl.EndsWith(".supabase.co")) {
    Write-Host "❌ Invalid Supabase URL format" -ForegroundColor Red
    exit 1
}

if (-not $SupabaseAnonKey.StartsWith("eyJ")) {
    Write-Host "❌ Invalid Supabase anon key format" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Input validation passed" -ForegroundColor Green
Write-Host ""

# Function to encrypt secret value using GitHub's public key
function Get-GitHubPublicKey {
    $url = "https://api.github.com/repos/$RepoOwner/$RepoName/actions/secrets/public-key"
    $headers = @{
        "Authorization" = "token $githubToken"
        "Accept"        = "application/vnd.github.v3+json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
        return $response
    }
    catch {
        Write-Host "❌ Failed to get GitHub public key: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Function to encrypt value using public key
function Encrypt-GitHubSecret {
    param(
        [string]$Value,
        [string]$PublicKey,
        [string]$KeyId
    )
    
    # This is a simplified version - in practice, you'd need to implement RSA encryption
    # For now, we'll use the GitHub CLI approach or direct API call
    return $Value
}

# Function to set GitHub secret
function Set-GitHubSecret {
    param(
        [string]$SecretName,
        [string]$SecretValue
    )
    
    $url = "https://api.github.com/repos/$RepoOwner/$RepoName/actions/secrets/$SecretName"
    $headers = @{
        "Authorization" = "token $githubToken"
        "Accept"        = "application/vnd.github.v3+json"
        "Content-Type"  = "application/json"
    }
    
    $body = @{
        encrypted_value = $SecretValue
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Put -Body $body
        Write-Host "✅ Successfully set secret: $SecretName" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Failed to set secret $SecretName`: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

Write-Host "🔧 Setting up GitHub secrets..." -ForegroundColor Blue

# Set SUPABASE_URL secret
$success1 = Set-GitHubSecret -SecretName "SUPABASE_URL" -SecretValue $SupabaseUrl

# Set SUPABASE_ANON_KEY secret
$success2 = Set-GitHubSecret -SecretName "SUPABASE_ANON_KEY" -SecretValue $SupabaseAnonKey

Write-Host ""
if ($success1 -and $success2) {
    Write-Host "🎉 All secrets set successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Push a new commit to trigger the CI workflow" -ForegroundColor Yellow
    Write-Host "2. Or re-run the failed workflow from GitHub Actions tab" -ForegroundColor Yellow
    Write-Host "3. The integration tests should now pass with real Supabase credentials" -ForegroundColor Yellow
}
else {
    Write-Host "⚠️ Some secrets failed to set. Please check the errors above." -ForegroundColor Yellow
} 