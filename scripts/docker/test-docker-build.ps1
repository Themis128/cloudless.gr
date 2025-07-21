#!/usr/bin/env pwsh

Write-Host "🧪 Testing Docker build process..." -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running" -ForegroundColor Red
    exit 1
}

# Clean up any existing test images
Write-Host "🧹 Cleaning up existing test images..." -ForegroundColor Yellow
docker rmi cloudlessgr-app:test 2>$null

# Build the test image
Write-Host "🔨 Building test Docker image..." -ForegroundColor Yellow
$buildArgs = @(
    "build",
    "--target", "runner",
    "--tag", "cloudlessgr-app:test",
    "--build-arg", "VERSION=test",
    "--build-arg", "GIT_COMMIT=test",
    "--build-arg", "GIT_BRANCH=test",
    "--build-arg", "BUILD_DATE=$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')",
    "--build-arg", "NODE_ENV=production",
    "-f", "Dockerfile",
    "."
)

$buildResult = docker $buildArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker build successful!" -ForegroundColor Green
    
    # List the image
    Write-Host "📋 Built image details:" -ForegroundColor Cyan
    docker images cloudlessgr-app:test
    
    # Test the image
    Write-Host "🧪 Testing Docker image..." -ForegroundColor Yellow
    $testResult = docker run --rm --name test-container cloudlessgr-app:test echo "✅ Container test successful"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker image test passed!" -ForegroundColor Green
        
        # Clean up
        Write-Host "🧹 Cleaning up test image..." -ForegroundColor Yellow
        docker rmi cloudlessgr-app:test
        
        Write-Host "🎉 All Docker tests passed!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "❌ Docker container test failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    Write-Host "Build output:" -ForegroundColor Red
    Write-Host $buildResult -ForegroundColor Red
    exit 1
} 