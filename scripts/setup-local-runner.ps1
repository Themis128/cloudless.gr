# 🚀 Local Self-Hosted GitHub Actions Runner Setup
# This script sets up a self-hosted runner on your local Windows machine

Write-Host "🚀 Setting up Local Self-Hosted GitHub Actions Runner" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

# Check if GITHUB_TOKEN is set
if (-not $env:GITHUB_TOKEN) {
    Write-Host "❌ GITHUB_TOKEN environment variable is not set!" -ForegroundColor Red
    Write-Host "Please set it with: `$env:GITHUB_TOKEN = 'your-token-here'" -ForegroundColor Yellow
    Write-Host "Or add it to your PowerShell profile for persistence" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ GITHUB_TOKEN is set" -ForegroundColor Green

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running or not installed!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again" -ForegroundColor Yellow
    exit 1
}

# Create runner directory
$runnerDir = ".\github-runner"
if (Test-Path $runnerDir) {
    Write-Host "🛑 Removing existing runner directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $runnerDir
}

Write-Host "📁 Creating runner directory..." -ForegroundColor Blue
New-Item -ItemType Directory -Path $runnerDir | Out-Null

# Download the latest runner
Write-Host "📥 Downloading GitHub Actions runner..." -ForegroundColor Blue
$runnerUrl = "https://github.com/actions/runner/releases/latest/download/actions-runner-win-x64-2.311.0.zip"
$runnerZip = "$runnerDir\actions-runner.zip"

try {
    Invoke-WebRequest -Uri $runnerUrl -OutFile $runnerZip
    Write-Host "✅ Runner downloaded successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to download runner: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Extract the runner
Write-Host "📦 Extracting runner..." -ForegroundColor Blue
try {
    Expand-Archive -Path $runnerZip -DestinationPath $runnerDir -Force
    Write-Host "✅ Runner extracted successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to extract runner: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Clean up zip file
Remove-Item $runnerZip

# Configure the runner
Write-Host "⚙️ Configuring runner..." -ForegroundColor Blue
Set-Location $runnerDir

try {
    # Get runner registration token
    $headers = @{
        "Authorization" = "token $env:GITHUB_TOKEN"
        "Accept" = "application/vnd.github.v3+json"
    }
    
    $repoUrl = "https://api.github.com/repos/Themis128/cloudless.gr/actions/runners/registration-token"
    $response = Invoke-RestMethod -Uri $repoUrl -Headers $headers -Method Post
    
    $registrationToken = $response.token
    Write-Host "✅ Got registration token" -ForegroundColor Green
    
    # Configure the runner
    $configArgs = @(
        "--url", "https://github.com/Themis128/cloudless.gr",
        "--token", $registrationToken,
        "--name", "cloudless-local-runner",
        "--labels", "windows,docker,dev,self-hosted",
        "--unattended",
        "--replace"
    )
    
    Write-Host "🔧 Running config.cmd..." -ForegroundColor Blue
    & ".\config.cmd" @configArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Runner configured successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to configure runner" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "❌ Failed to get registration token: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure your GITHUB_TOKEN has the 'actions' permission" -ForegroundColor Yellow
    exit 1
}

# Install and start the runner service
Write-Host "🚀 Installing and starting runner service..." -ForegroundColor Blue
try {
    & ".\svc.cmd" install
    & ".\svc.cmd" start
    
    Write-Host "✅ Runner service installed and started!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install/start service: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "You can still run the runner manually with: .\run.cmd" -ForegroundColor Yellow
}

# Go back to original directory
Set-Location ..

Write-Host ""
Write-Host "🎉 Local Self-Hosted Runner Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Runner Information:" -ForegroundColor Cyan
Write-Host "  • Name: cloudless-local-runner" -ForegroundColor White
Write-Host "  • Labels: windows, docker, dev, self-hosted" -ForegroundColor White
Write-Host "  • Directory: $runnerDir" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Management Commands:" -ForegroundColor Cyan
Write-Host "  • Check status: Get-Service actions.runner.*" -ForegroundColor White
Write-Host "  • Start service: Start-Service actions.runner.*" -ForegroundColor White
Write-Host "  • Stop service: Stop-Service actions.runner.*" -ForegroundColor White
Write-Host "  • View logs: Get-EventLog -LogName Application -Source actions.runner.*" -ForegroundColor White
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Push your code to trigger the workflow" -ForegroundColor White
Write-Host "  2. Check GitHub Actions to see the runner in action" -ForegroundColor White
Write-Host "  3. The workflow will run on your local machine!" -ForegroundColor White
Write-Host ""
Write-Host "✅ No more billing limits! 🎉" -ForegroundColor Green 