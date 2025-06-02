#!/usr/bin/env powershell
# Docker Deployment Script for Cloudless.gr Platform
# This script helps deploy the application with proper Supabase configuration

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "prod", "status", "stop", "clean", "logs")]
    [string]$Action = "dev",

    [Parameter(Mandatory=$false)]
    [switch]$Detached,

    [Parameter(Mandatory=$false)]
    [switch]$Build,

    [Parameter(Mandatory=$false)]
    [switch]$ValidateEnv
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$Cyan = "Cyan"

function Write-ColorMessage {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Show-Header {
    Write-ColorMessage "🚀 Cloudless.gr Platform - Docker Deployment" $Blue
    Write-ColorMessage "=============================================" $Blue
}

function Test-DockerInstallation {
    Write-ColorMessage "🔍 Checking Docker installation..." $Cyan

    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            Write-ColorMessage "✅ Docker found: $dockerVersion" $Green
        } else {
            Write-ColorMessage "❌ Docker not found. Please install Docker Desktop." $Red
            exit 1
        }
    } catch {
        Write-ColorMessage "❌ Docker not found. Please install Docker Desktop." $Red
        exit 1
    }

    try {
        $composeVersion = docker-compose --version 2>$null
        if ($composeVersion) {
            Write-ColorMessage "✅ Docker Compose found: $composeVersion" $Green
        } else {
            Write-ColorMessage "❌ Docker Compose not found." $Red
            exit 1
        }
    } catch {
        Write-ColorMessage "❌ Docker Compose not found." $Red
        exit 1
    }
}

function Test-EnvironmentVariables {
    Write-ColorMessage "🔍 Checking environment variables..." $Cyan

    $requiredVars = @(
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "NUXT_JWT_SECRET"
    )

    $missing = @()

    foreach ($var in $requiredVars) {
        $value = [Environment]::GetEnvironmentVariable($var)
        if (-not $value -or $value -eq "") {
            $missing += $var
        } else {
            Write-ColorMessage "✅ $var is set" $Green
        }
    }

    if ($missing.Count -gt 0) {
        Write-ColorMessage "❌ Missing required environment variables:" $Red
        foreach ($var in $missing) {
            Write-ColorMessage "   - $var" $Red
        }
        Write-ColorMessage "📋 Please check your .env file or set these variables." $Yellow
        Write-ColorMessage "📄 See .env.docker.template for reference." $Yellow

        if ($Action -eq "prod") {
            Write-ColorMessage "❌ Cannot start production without all required variables." $Red
            exit 1
        } else {
            Write-ColorMessage "⚠️  Continuing with development mode (some features may not work)." $Yellow
        }
    } else {
        Write-ColorMessage "✅ All required environment variables are set!" $Green
    }
}

function Test-SupabaseConnection {
    Write-ColorMessage "🔍 Testing Supabase connection..." $Cyan

    $supabaseUrl = [Environment]::GetEnvironmentVariable("SUPABASE_URL")
    $supabaseKey = [Environment]::GetEnvironmentVariable("SUPABASE_ANON_KEY")

    if ($supabaseUrl -and $supabaseKey) {
        try {
            $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/" -Headers @{
                "apikey" = $supabaseKey
                "Authorization" = "Bearer $supabaseKey"
            } -Method GET -TimeoutSec 10

            Write-ColorMessage "✅ Supabase connection successful!" $Green
        } catch {
            Write-ColorMessage "⚠️  Could not connect to Supabase. Please check your credentials." $Yellow
            Write-ColorMessage "   URL: $supabaseUrl" $Yellow
            Write-ColorMessage "   Error: $($_.Exception.Message)" $Red
        }
    } else {
        Write-ColorMessage "⚠️  Supabase credentials not found in environment." $Yellow
    }
}

function Start-Development {
    Write-ColorMessage "🚀 Starting development environment..." $Green

    $composeFile = "docker-compose.dev.yml"
    $flags = @("--build")

    if ($Detached) {
        $flags += "-d"
        Write-ColorMessage "📦 Starting in detached mode..." $Cyan
    }

    try {
        docker-compose -f $composeFile up @flags

        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage "✅ Development environment started successfully!" $Green
            Write-ColorMessage "🌐 Application should be available at: http://localhost:3000" $Cyan
            Write-ColorMessage "📊 Supabase Demo: http://localhost:3000/supabase-demo" $Cyan
            Write-ColorMessage "🗄️  MinIO Console: http://localhost:9001" $Cyan
            Write-ColorMessage "🔧 Portainer: http://localhost:9002" $Cyan
        } else {
            Write-ColorMessage "❌ Failed to start development environment." $Red
        }
    } catch {
        Write-ColorMessage "❌ Error starting development environment: $($_.Exception.Message)" $Red
    }
}

function Start-Production {
    Write-ColorMessage "🚀 Starting production environment..." $Green

    $composeFile = "docker-compose.prod.yml"
    $flags = @("--build")

    if ($Detached) {
        $flags += "-d"
        Write-ColorMessage "📦 Starting in detached mode..." $Cyan
    }

    try {
        docker-compose -f $composeFile up @flags

        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage "✅ Production environment started successfully!" $Green
            Write-ColorMessage "🌐 Application should be available at: http://localhost:3000" $Cyan
        } else {
            Write-ColorMessage "❌ Failed to start production environment." $Red
        }
    } catch {
        Write-ColorMessage "❌ Error starting production environment: $($_.Exception.Message)" $Red
    }
}

function Show-Status {
    Write-ColorMessage "📊 Docker container status:" $Cyan
    docker-compose -f docker-compose.dev.yml ps
    docker-compose -f docker-compose.prod.yml ps
}

function Stop-Containers {
    Write-ColorMessage "🛑 Stopping all containers..." $Yellow
    docker-compose -f docker-compose.dev.yml down
    docker-compose -f docker-compose.prod.yml down
    Write-ColorMessage "✅ All containers stopped." $Green
}

function Clean-Containers {
    Write-ColorMessage "🧹 Cleaning up containers and volumes..." $Yellow
    docker-compose -f docker-compose.dev.yml down -v
    docker-compose -f docker-compose.prod.yml down -v
    Write-ColorMessage "✅ Cleanup completed." $Green
}

function Show-Logs {
    Write-ColorMessage "📄 Showing application logs..." $Cyan
    docker-compose -f docker-compose.dev.yml logs -f nuxt-app
}

# Main execution
Show-Header

# Always check Docker installation
Test-DockerInstallation

# Validate environment if requested or for production
if ($ValidateEnv -or $Action -eq "prod") {
    Test-EnvironmentVariables
    Test-SupabaseConnection
}

# Execute the requested action
switch ($Action) {
    "dev" {
        Start-Development
    }
    "prod" {
        Start-Production
    }
    "status" {
        Show-Status
    }
    "stop" {
        Stop-Containers
    }
    "clean" {
        Clean-Containers
    }
    "logs" {
        Show-Logs
    }
    default {
        Write-ColorMessage "❌ Unknown action: $Action" $Red
        Write-ColorMessage "Valid actions: dev, prod, status, stop, clean, logs" $Yellow
    }
}

Write-ColorMessage "`n🎉 Script completed!" $Green
