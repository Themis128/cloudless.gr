# Docker Image Versioning Script for PowerShell
# This script generates version tags for Docker images

param(
    [string]$Registry = "",
    [string]$ImageName = "cloudlessgr-app",
    [switch]$Push = $false
)

# Get the current version from package.json
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$VERSION = $packageJson.version

# Get git information
try {
    $GIT_COMMIT = git rev-parse --short HEAD 2>$null
    if (-not $GIT_COMMIT) { $GIT_COMMIT = "unknown" }
}
catch {
    $GIT_COMMIT = "unknown"
}

try {
    $GIT_BRANCH = git rev-parse --abbrev-ref HEAD 2>$null
    if (-not $GIT_BRANCH) { $GIT_BRANCH = "unknown" }
}
catch {
    $GIT_BRANCH = "unknown"
}

$BUILD_DATE = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"

# Generate different version tags
$TAGS = @(
    "${ImageName}:latest",
    "${ImageName}:v${VERSION}",
    "${ImageName}:v${VERSION}-${GIT_COMMIT}",
    "${ImageName}:${GIT_BRANCH}",
    "${ImageName}:${GIT_BRANCH}-${GIT_COMMIT}"
)

# Add registry prefix if provided
if ($Registry) {
    $TAGS = $TAGS | ForEach-Object { "${Registry}/${_}" }
}

Write-Host "Building Docker image with versioning..." -ForegroundColor Green
Write-Host "Version: $VERSION" -ForegroundColor Yellow
Write-Host "Git Commit: $GIT_COMMIT" -ForegroundColor Yellow
Write-Host "Git Branch: $GIT_BRANCH" -ForegroundColor Yellow
Write-Host "Build Date: $BUILD_DATE" -ForegroundColor Yellow
Write-Host ""

# Build the image with all tags
$TAG_ARGS = $TAGS | ForEach-Object { "-t", $_ }
$BUILD_ARGS = @(
    "--build-arg", "VERSION=$VERSION",
    "--build-arg", "GIT_COMMIT=$GIT_COMMIT",
    "--build-arg", "GIT_BRANCH=$GIT_BRANCH",
    "--build-arg", "BUILD_DATE=$BUILD_DATE"
)

# Build the image
$buildCmd = @("docker", "build") + $BUILD_ARGS + $TAG_ARGS + "."
Write-Host "Running: $($buildCmd -join ' ')" -ForegroundColor Cyan
& docker build $BUILD_ARGS $TAG_ARGS .

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Successfully built image with tags:" -ForegroundColor Green
    foreach ($tag in $TAGS) {
        Write-Host "  - $tag" -ForegroundColor White
    }

    # Save version info to a file for reference
    $versionInfo = @"
VERSION=$VERSION
GIT_COMMIT=$GIT_COMMIT
GIT_BRANCH=$GIT_BRANCH
BUILD_DATE=$BUILD_DATE
IMAGE_NAME=$ImageName
TAGS=$($TAGS -join ' ')
"@
    $versionInfo | Out-File -FilePath ".docker-version" -Encoding UTF8

    Write-Host ""
    Write-Host "Version information saved to .docker-version" -ForegroundColor Green

    # Push images if requested
    if ($Push) {
        Write-Host ""
        Write-Host "Pushing images to registry..." -ForegroundColor Green
        foreach ($tag in $TAGS) {
            Write-Host "Pushing $tag..." -ForegroundColor Yellow
            docker push $tag
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Failed to push $tag" -ForegroundColor Red
            }
        }
    }
}
else {
    Write-Host "Failed to build Docker image" -ForegroundColor Red
    exit 1
} 