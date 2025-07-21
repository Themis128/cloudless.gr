#!/usr/bin/env pwsh

Write-Host "🚀 GitHub Actions Self-Hosted Runner Setup (with ENV)" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "github-runner")) {
    Write-Host "❌ github-runner directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Yellow
    exit 1
}

Write-Host "🔍 Checking prerequisites..." -ForegroundColor Cyan

# Check if runner files exist
if (-not (Test-Path "github-runner\config.cmd")) {
    Write-Host "❌ Runner files not found in github-runner directory!" -ForegroundColor Red
    Write-Host "Please download and extract the runner first." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Runner files found" -ForegroundColor Green

# Try to get token from environment variables
$token = $null
$envVars = @("GITHUB_TOKEN", "RUNNER_TOKEN", "GITHUB_RUNNER_TOKEN", "ACTIONS_RUNNER_TOKEN")

Write-Host ""
Write-Host "🔍 Checking for token in environment variables..." -ForegroundColor Cyan

foreach ($envVar in $envVars) {
    $envValue = [Environment]::GetEnvironmentVariable($envVar)
    if ($envValue) {
        Write-Host "✅ Found token in $envVar" -ForegroundColor Green
        $token = $envValue
        break
    }
}

# If no token found in environment, prompt user
if (-not $token) {
    Write-Host ""
    Write-Host "🔐 GitHub Registration Token Required" -ForegroundColor Yellow
    Write-Host "=====================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To get your registration token:" -ForegroundColor White
    Write-Host "1. Go to: https://github.com/Themis128/cloudless.gr/settings/actions/runners" -ForegroundColor Cyan
    Write-Host "2. Click 'New self-hosted runner'" -ForegroundColor Cyan
    Write-Host "3. Choose 'Windows' and copy the registration token" -ForegroundColor Cyan
    Write-Host "4. Paste it below when prompted" -ForegroundColor Cyan
    Write-Host ""

    $token = Read-Host "Enter your GitHub registration token" -AsSecureString
    $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))
}

if (-not $token) {
    Write-Host "❌ No token provided!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⚙️ Configuring runner..." -ForegroundColor Cyan

# Configure the runner
Set-Location "github-runner"
try {
    $configArgs = @(
        "--url", "https://github.com/Themis128/cloudless.gr",
        "--token", $token,
        "--name", "cloudless-windows-runner",
        "--labels", "windows,self-hosted,dev",
        "--unattended",
        "--replace"
    )
    
    Write-Host "Running: .\config.cmd $($configArgs -join ' ')" -ForegroundColor Gray
    & .\config.cmd @configArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Runner configured successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🚀 Starting runner..." -ForegroundColor Cyan
        Write-Host "Press Ctrl+C to stop the runner" -ForegroundColor Yellow
        Write-Host ""
        
        # Start the runner
        & .\run.cmd
    } else {
        Write-Host "❌ Failed to configure runner!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error configuring runner: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Set-Location ".."
} 