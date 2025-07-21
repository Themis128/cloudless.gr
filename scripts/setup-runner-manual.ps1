# Manual GitHub Actions Runner Setup
# This script downloads and configures the official GitHub Actions runner

Write-Host "🚀 Manual GitHub Actions Runner Setup" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Check if GITHUB_TOKEN is set
if (-not $env:GITHUB_TOKEN) {
    Write-Host "❌ GITHUB_TOKEN environment variable is not set!" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 To get a GitHub token:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://github.com/settings/tokens" -ForegroundColor Cyan
    Write-Host "  2. Click 'Generate new token (classic)'" -ForegroundColor Cyan
    Write-Host "  3. Select scopes: 'repo' and 'workflow'" -ForegroundColor Cyan
    Write-Host "  4. Copy the token" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 Set the token:" -ForegroundColor Yellow
    Write-Host "  `$env:GITHUB_TOKEN = 'your-github-token'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🔄 Then run this script again" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ GITHUB_TOKEN is set" -ForegroundColor Green

# Get repository information
Write-Host "📋 Getting repository information..." -ForegroundColor Blue
$repoUrl = git config --get remote.origin.url
if ($repoUrl -match "github\.com/([^/]+)/([^/]+)\.git") {
    $owner = $matches[1]
    $repo = $matches[2]
    Write-Host "✅ Repository: $owner/$repo" -ForegroundColor Green
} else {
    Write-Host "❌ Could not parse repository URL: $repoUrl" -ForegroundColor Red
    exit 1
}

# Create runner directory
Write-Host "📁 Creating runner directory..." -ForegroundColor Blue
$runnerDir = "actions-runner"
if (Test-Path $runnerDir) {
    Write-Host "🛑 Removing existing runner directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $runnerDir
}
New-Item -ItemType Directory -Force -Path $runnerDir | Out-Null
Set-Location $runnerDir

# Download the runner
Write-Host "⬇️ Downloading GitHub Actions runner..." -ForegroundColor Blue
$runnerVersion = "2.311.0"
$runnerUrl = "https://github.com/actions/runner/releases/download/v$runnerVersion/actions-runner-win-x64-$runnerVersion.zip"
$zipFile = "actions-runner-win-x64-$runnerVersion.zip"

try {
    Invoke-WebRequest -Uri $runnerUrl -OutFile $zipFile
    Write-Host "✅ Runner downloaded successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to download runner: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Extract the runner
Write-Host "📦 Extracting runner..." -ForegroundColor Blue
try {
    Expand-Archive -Path $zipFile -DestinationPath . -Force
    Write-Host "✅ Runner extracted successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to extract runner: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Configure the runner
Write-Host "⚙️ Configuring runner..." -ForegroundColor Blue
try {
    $configArgs = @(
        "--url", "https://github.com/$owner/$repo"
        "--token", $env:GITHUB_TOKEN
        "--name", "cloudless-dev-runner"
        "--labels", "windows,docker,dev,self-hosted"
        "--unattended"
        "--replace"
    )
    
    & .\config.cmd @configArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Runner configured successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to configure runner" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error configuring runner: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Install as a service
Write-Host "🔧 Installing runner as a service..." -ForegroundColor Blue
try {
    & .\svc.install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Runner service installed successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Failed to install as service, but runner can still be used manually" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Could not install as service: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Start the service
Write-Host "🚀 Starting runner service..." -ForegroundColor Blue
try {
    & .\svc.start
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Runner service started successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Failed to start service, but runner can be started manually" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Could not start service: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Go back to project directory
Set-Location ..

Write-Host ""
Write-Host "🎉 Manual Runner Setup Complete!" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green
Write-Host ""
Write-Host "✅ GitHub Actions runner is now configured" -ForegroundColor Green
Write-Host "✅ It will automatically pick up new workflow jobs" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Monitor the runner:" -ForegroundColor Blue
Write-Host "  • Service status: Get-Service actions.runner.*" -ForegroundColor Cyan
Write-Host "  • Manual start: cd actions-runner && .\run.cmd" -ForegroundColor Cyan
Write-Host "  • Service start: cd actions-runner && .\svc.start" -ForegroundColor Cyan
Write-Host ""
Write-Host "🛑 Stop the runner:" -ForegroundColor Blue
Write-Host "  cd actions-runner && .\svc.stop" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Restart the runner:" -ForegroundColor Blue
Write-Host "  cd actions-runner && .\svc.restart" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 Now try running your GitHub Actions workflow again!" -ForegroundColor Green
Write-Host "   The '🔍 Validate Configuration' step should now work!" -ForegroundColor Green 