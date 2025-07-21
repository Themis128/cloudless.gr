# Docker Deployment Script with Versioning
# This script deploys a versioned Docker image

param(
    [string]$Version = "",
    [string]$Environment = "production",
    [string]$ImageName = "cloudlessgr-app",
    [string]$Registry = "",
    [int]$Port = 3000,
    [switch]$Build = $false,
    [switch]$Push = $false,
    [switch]$Force = $false,
    [string]$EnvFile = ".env"
)

# Colors for output
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

# Get version from package.json if not specified
if (-not $Version) {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $Version = $packageJson.version
}

# Determine image tag
$ImageTag = if ($Registry) { "${Registry}/${ImageName}:v${Version}" } else { "${ImageName}:v${Version}" }
$ContainerName = "cloudless-${Environment}"

Write-ColorOutput "=== Cloudless Deployment Script ===" $Green
Write-ColorOutput "Environment: $Environment" $Yellow
Write-ColorOutput "Version: $Version" $Yellow
Write-ColorOutput "Image: $ImageTag" $Yellow
Write-ColorOutput "Container: $ContainerName" $Yellow
Write-ColorOutput "Port: $Port" $Yellow
Write-ColorOutput "Env File: $EnvFile" $Yellow
Write-ColorOutput ""

# Check if .env file exists
if (-not (Test-Path $EnvFile)) {
    Write-ColorOutput "Warning: $EnvFile not found. Using default environment variables." $Yellow
    Write-ColorOutput "Create $EnvFile from env.example for custom configuration." $Yellow
}

# Build image if requested
if ($Build) {
    Write-ColorOutput "Building Docker image..." $Cyan
    if ($Push) {
        & npm run docker:build:win:push
    }
    else {
        & npm run docker:build:win
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "Failed to build Docker image" $Red
        exit 1
    }
}

# Check if image exists
Write-ColorOutput "Checking if image exists..." $Cyan
$imageExists = docker images --format "table {{.Repository}}:{{.Tag}}" | Select-String -Pattern $ImageTag

if (-not $imageExists) {
    Write-ColorOutput "Image $ImageTag not found locally" $Red
    Write-ColorOutput "Attempting to pull from registry..." $Yellow
    
    docker pull $ImageTag
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "Failed to pull image. Please build it first with -Build flag" $Red
        exit 1
    }
}

# Stop and remove existing container
Write-ColorOutput "Stopping existing container..." $Cyan
docker stop $ContainerName 2>$null
docker rm $ContainerName 2>$null

# Build docker run command
$dockerArgs = @(
    "run",
    "-d",
    "--name", $ContainerName,
    "-p", "${Port}:3000"
)

# Add environment file if it exists
if (Test-Path $EnvFile) {
    Write-ColorOutput "Using environment file: $EnvFile" $Cyan
    $dockerArgs += "--env-file", $EnvFile
}
else {
    Write-ColorOutput "Using default environment variables..." $Cyan
    # Default environment variables
    $envVars = @(
        "NUXT_PUBLIC_SUPABASE_URL=https://oflctqligzouzshimuqh.supabase.co",
        "NUXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MTQ3NDUsImV4cCI6MjA2NDM5MDc0NX0.Z1VgH0O77UM2Zb-J4a3fWNTTSFsfHZFmhsAUKJCJInc",
        "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
        "NODE_ENV=production"
    )
    
    # Add environment variables
    foreach ($envVar in $envVars) {
        $dockerArgs += "-e", $envVar
    }
}

# Add restart policy
$dockerArgs += "--restart", "unless-stopped"

# Add image
$dockerArgs += $ImageTag

Write-ColorOutput "Starting container..." $Cyan
Write-ColorOutput "Command: docker $($dockerArgs -join ' ')" $Cyan

# Run the container
& docker $dockerArgs

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput ""
    Write-ColorOutput "=== Deployment Successful ===" $Green
    Write-ColorOutput "Container: $ContainerName" $Yellow
    Write-ColorOutput "Image: $ImageTag" $Yellow
    Write-ColorOutput "URL: http://localhost:$Port" $Yellow
    Write-ColorOutput ""
    
    # Show container status
    Write-ColorOutput "Container status:" $Cyan
    docker ps --filter "name=$ContainerName" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    # Show logs
    Write-ColorOutput ""
    Write-ColorOutput "Container logs:" $Cyan
    docker logs --tail 10 $ContainerName
    
}
else {
    Write-ColorOutput "Failed to start container" $Red
    exit 1
}

# Save deployment info
$deploymentInfo = @"
DEPLOYMENT_INFO
===============
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Environment: $Environment
Version: $Version
Image: $ImageTag
Container: $ContainerName
Port: $Port
Registry: $Registry
Env File: $EnvFile
"@

$deploymentInfo | Out-File -FilePath ".deployment-info" -Encoding UTF8
Write-ColorOutput "Deployment info saved to .deployment-info" $Green 