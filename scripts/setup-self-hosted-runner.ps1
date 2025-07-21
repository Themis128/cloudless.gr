# Self-Hosted Runner Setup Script for Windows
# This script sets up a GitHub Actions self-hosted runner for cloudless.gr

param(
    [string]$GitHubToken = $env:GITHUB_TOKEN,
    [string]$RunnerType = "docker"
)

# Configuration
$RepoOwner = "Themis128"
$RepoName = "cloudless.gr"
$RepoUrl = "https://github.com/$RepoOwner/$RepoName"
$RunnerVersion = "2.311.0"
$RunnerName = "cloudless-runner-$env:COMPUTERNAME"
$RunnerLabels = "windows,docker,self-hosted"

# Function to write colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to check prerequisites
function Test-Prerequisites {
    Write-Status "Checking prerequisites..."
    
    # Check if running as administrator
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
    if ($isAdmin) {
        Write-Warning "Running as administrator. Consider running as regular user for security."
    }
    
    # Check if Docker Desktop is installed
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Warning "Docker not found. Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
        Write-Status "After installing Docker Desktop, restart this script."
        exit 1
    } else {
        Write-Success "Docker is installed"
    }
    
    # Check if Docker is running
    try {
        docker version | Out-Null
        Write-Success "Docker is running"
    } catch {
        Write-Error "Docker is not running. Please start Docker Desktop."
        exit 1
    }
    
    # Check available disk space (minimum 20GB)
    $drive = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $availableSpaceGB = [math]::Round($drive.FreeSpace / 1GB, 2)
    
    if ($availableSpaceGB -lt 20) {
        Write-Error "Insufficient disk space. Need at least 20GB, available: ${availableSpaceGB}GB"
        exit 1
    } else {
        Write-Success "Sufficient disk space available: ${availableSpaceGB}GB"
    }
    
    Write-Success "Prerequisites check completed"
}

# Function to get GitHub token
function Get-GitHubToken {
    Write-Status "Setting up GitHub token..."
    
    if ([string]::IsNullOrEmpty($GitHubToken)) {
        Write-Warning "GitHub token not provided"
        Write-Host "Please provide your GitHub Personal Access Token:"
        Write-Host "1. Go to https://github.com/settings/tokens"
        Write-Host "2. Generate a new token with 'repo' and 'admin:org' scopes"
        Write-Host "3. Enter the token below:"
        $GitHubToken = Read-Host -AsSecureString "GitHub Token"
        $GitHubToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($GitHubToken))
        
        if ([string]::IsNullOrEmpty($GitHubToken)) {
            Write-Error "GitHub token is required"
            exit 1
        }
    }
    
    # Test the token
    Write-Status "Testing GitHub token..."
    $headers = @{
        "Authorization" = "token $GitHubToken"
        "Accept" = "application/vnd.github.v3+json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName" -Headers $headers
        Write-Success "GitHub token is valid"
    } catch {
        Write-Error "Invalid GitHub token or insufficient permissions"
        exit 1
    }
    
    return $GitHubToken
}

# Function to setup Docker-based runner
function Setup-DockerRunner {
    Write-Status "Setting up Docker-based runner..."
    
    # Create runner directory
    $RunnerDir = "$env:USERPROFILE\github-runners"
    New-Item -ItemType Directory -Path $RunnerDir -Force | Out-Null
    Set-Location $RunnerDir
    
    # Create docker-compose.yml
    $dockerComposeContent = @"
version: '3.8'
services:
  github-runner:
    image: myoung34/github-runner:latest
    container_name: github-runner
    restart: unless-stopped
    environment:
      - RUNNER_NAME=$RunnerName
      - RUNNER_TOKEN=$GitHubToken
      - RUNNER_REPOSITORY_URL=$RepoUrl
      - RUNNER_LABELS=$RunnerLabels
      - RUNNER_WORKDIR=/tmp/github-runner
      - RUNNER_EPHEMERAL=true
      - RUNNER_DISABLE_AUTO_UPDATE=true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./runner-data:/data
      - ./cache:/cache
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
"@
    
    $dockerComposeContent | Out-File -FilePath "docker-compose.yml" -Encoding UTF8
    
    # Create cache directory
    New-Item -ItemType Directory -Path "cache" -Force | Out-Null
    
    # Start the runner
    Write-Status "Starting GitHub runner..."
    docker-compose up -d
    
    # Wait for runner to start
    Write-Status "Waiting for runner to start..."
    Start-Sleep -Seconds 10
    
    # Check runner status
    $runnerStatus = docker-compose ps
    if ($runnerStatus -match "Up") {
        Write-Success "GitHub runner started successfully"
    } else {
        Write-Error "Failed to start GitHub runner"
        docker-compose logs
        exit 1
    }
}

# Function to setup native runner
function Setup-NativeRunner {
    Write-Status "Setting up native runner..."
    
    # Create runner directory
    $RunnerDir = "$env:USERPROFILE\github-runner"
    New-Item -ItemType Directory -Path $RunnerDir -Force | Out-Null
    Set-Location $RunnerDir
    
    # Download runner
    Write-Status "Downloading GitHub Actions runner..."
    $runnerUrl = "https://github.com/actions/runner/releases/download/v$RunnerVersion/actions-runner-win-x64-$RunnerVersion.zip"
    $runnerZip = "actions-runner-win-x64-$RunnerVersion.zip"
    
    Invoke-WebRequest -Uri $runnerUrl -OutFile $runnerZip
    
    # Extract runner
    Write-Status "Extracting runner..."
    Expand-Archive -Path $runnerZip -DestinationPath "." -Force
    
    # Configure runner
    Write-Status "Configuring runner..."
    $configArgs = @(
        "--url", $RepoUrl,
        "--token", $GitHubToken,
        "--name", $RunnerName,
        "--labels", $RunnerLabels,
        "--unattended",
        "--replace"
    )
    
    & ".\config.cmd" @configArgs
    
    # Install service
    Write-Status "Installing runner service..."
    & ".\svc.install"
    & ".\svc.start"
    
    Write-Success "Native runner setup completed"
}

# Function to setup monitoring
function Setup-Monitoring {
    Write-Status "Setting up monitoring..."
    
    # Create monitoring script
    $monitorScript = @"
# Runner monitoring script for Windows
`$RunnerDir = "`$env:USERPROFILE\github-runners"

if (Test-Path `$RunnerDir) {
    Set-Location `$RunnerDir
    `$status = docker-compose ps
    if (`$status -match "Up") {
        Write-Host "✅ Runner is running" -ForegroundColor Green
        docker-compose logs --tail=10
    } else {
        Write-Host "❌ Runner is not running" -ForegroundColor Red
        docker-compose up -d
    }
} else {
    Write-Host "❌ Runner directory not found" -ForegroundColor Red
}
"@
    
    $monitorScript | Out-File -FilePath "$env:USERPROFILE\monitor-runner.ps1" -Encoding UTF8
    
    # Create scheduled task for monitoring
    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File `"$env:USERPROFILE\monitor-runner.ps1`""
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
    
    Register-ScheduledTask -TaskName "GitHubRunnerMonitor" -Action $action -Trigger $trigger -Principal $principal -Description "Monitor GitHub Actions runner" | Out-Null
    
    Write-Success "Monitoring setup completed"
}

# Function to display setup information
function Show-SetupInfo {
    Write-Success "Self-hosted runner setup completed!"
    Write-Host ""
    Write-Host "📋 Setup Information:" -ForegroundColor Cyan
    Write-Host "  Repository: $RepoUrl"
    Write-Host "  Runner Name: $RunnerName"
    Write-Host "  Runner Labels: $RunnerLabels"
    Write-Host "  Runner Directory: $env:USERPROFILE\github-runners"
    Write-Host ""
    Write-Host "🔧 Management Commands:" -ForegroundColor Cyan
    Write-Host "  Start runner: cd $env:USERPROFILE\github-runners && docker-compose up -d"
    Write-Host "  Stop runner: cd $env:USERPROFILE\github-runners && docker-compose down"
    Write-Host "  View logs: cd $env:USERPROFILE\github-runners && docker-compose logs -f"
    Write-Host "  Monitor status: $env:USERPROFILE\monitor-runner.ps1"
    Write-Host ""
    Write-Host "🌐 Runner Status:" -ForegroundColor Cyan
    Write-Host "  Health check: http://localhost:8080/health"
    Write-Host "  GitHub: https://github.com/$RepoOwner/$RepoName/settings/actions/runners"
    Write-Host ""
    Write-Host "⚠️  Important Notes:" -ForegroundColor Yellow
    Write-Host "  - Keep your GitHub token secure"
    Write-Host "  - Monitor runner performance regularly"
    Write-Host "  - Update runner software periodically"
    Write-Host "  - Backup runner configuration"
}

# Main execution
function Main {
    Write-Host "🚀 GitHub Actions Self-Hosted Runner Setup for Windows" -ForegroundColor Cyan
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check prerequisites
    Test-Prerequisites
    
    # Get GitHub token
    $GitHubToken = Get-GitHubToken
    
    # Determine runner type
    if ([string]::IsNullOrEmpty($RunnerType)) {
        Write-Host "Choose runner type:"
        Write-Host "1. Docker-based runner (recommended)"
        Write-Host "2. Native runner"
        $choice = Read-Host "Enter your choice (1 or 2)"
        
        switch ($choice) {
            "1" { $RunnerType = "docker" }
            "2" { $RunnerType = "native" }
            default {
                Write-Error "Invalid choice"
                exit 1
            }
        }
    }
    
    # Setup runner based on type
    switch ($RunnerType.ToLower()) {
        "docker" {
            Setup-DockerRunner
        }
        "native" {
            Setup-NativeRunner
        }
        default {
            Write-Error "Invalid runner type: $RunnerType"
            exit 1
        }
    }
    
    # Setup monitoring
    Setup-Monitoring
    
    # Display information
    Show-SetupInfo
}

# Run main function
Main 