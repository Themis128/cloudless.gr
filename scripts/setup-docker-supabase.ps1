# Docker Supabase Setup Script for Cloudless LLM Dev Agent
# This script helps quickly set up Docker with proper Supabase connection

param(
    [string]$SupabaseUrl,
    [string]$SupabaseAnonKey,
    [string]$SupabaseServiceKey,
    [switch]$Force
)

# Colors for output
$Red = [System.ConsoleColor]::Red
$Green = [System.ConsoleColor]::Green
$Yellow = [System.ConsoleColor]::Yellow
$Blue = [System.ConsoleColor]::Blue
$Cyan = [System.ConsoleColor]::Cyan

function Write-Status {
    param(
        [string]$Status,
        [string]$Message
    )
    
    switch ($Status) {
        "success" { Write-Host "✅ $Message" -ForegroundColor Green }
        "error" { Write-Host "❌ $Message" -ForegroundColor Red }
        "warning" { Write-Host "⚠️ $Message" -ForegroundColor Yellow }
        "info" { Write-Host "ℹ️ $Message" -ForegroundColor Blue }
        "header" { Write-Host "🔧 $Message" -ForegroundColor Cyan }
    }
}

Write-Host "🐳 Docker Supabase Setup for Cloudless LLM Dev Agent" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# Check if Docker is running
function Test-Docker {
    Write-Status "info" "Checking Docker status..."
    try {
        docker info | Out-Null
        Write-Status "success" "Docker is running"
        return $true
    }
    catch {
        Write-Status "error" "Docker is not running or not accessible"
        Write-Status "info" "Please start Docker Desktop and try again"
        return $false
    }
}

# Setup environment file
function Setup-Environment {
    Write-Status "info" "Setting up environment configuration..."
    
    # Check if .env already exists
    if (Test-Path ".env") {
        if (-not $Force) {
            Write-Status "warning" ".env file already exists"
            $response = Read-Host "Do you want to overwrite it? (y/N)"
            if ($response -ne "y" -and $response -ne "Y") {
                Write-Status "info" "Skipping .env creation"
                return
            }
        }
    }
    
    # Copy template
    if (Test-Path "docker.env.example") {
        Copy-Item "docker.env.example" ".env"
        Write-Status "success" "Created .env from template"
    }
    else {
        Write-Status "error" "docker.env.example not found"
        return $false
    }
    
    # Get Supabase credentials if not provided
    if (-not $SupabaseUrl) {
        $SupabaseUrl = Read-Host "Enter your Supabase URL (e.g., https://your-project.supabase.co)"
    }
    
    if (-not $SupabaseAnonKey) {
        $SupabaseAnonKey = Read-Host "Enter your Supabase Anonymous Key"
    }
    
    if (-not $SupabaseServiceKey) {
        $SupabaseServiceKey = Read-Host "Enter your Supabase Service Role Key (optional)"
    }
    
    # Update .env file
    $envContent = Get-Content ".env"
    $envContent = $envContent -replace 'NUXT_PUBLIC_SUPABASE_URL=.*', "NUXT_PUBLIC_SUPABASE_URL=$SupabaseUrl"
    $envContent = $envContent -replace 'NUXT_PUBLIC_SUPABASE_ANON_KEY=.*', "NUXT_PUBLIC_SUPABASE_ANON_KEY=$SupabaseAnonKey"
    
    if ($SupabaseServiceKey) {
        $envContent = $envContent -replace 'SUPABASE_SERVICE_ROLE_KEY=.*', "SUPABASE_SERVICE_ROLE_KEY=$SupabaseServiceKey"
    }
    
    Set-Content ".env" $envContent
    Write-Status "success" "Updated .env with Supabase credentials"
    
    return $true
}

# Test Supabase connection
function Test-SupabaseConnection {
    Write-Status "info" "Testing Supabase connection..."
    
    try {
        $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/" -Headers @{
            "apikey"        = $SupabaseAnonKey
            "Authorization" = "Bearer $SupabaseAnonKey"
        } -TimeoutSec 10
        
        if ($response.StatusCode -eq 200) {
            Write-Status "success" "Supabase connection successful"
            return $true
        }
        else {
            Write-Status "error" "Supabase connection failed with status: $($response.StatusCode)"
            return $false
        }
    }
    catch {
        Write-Status "error" "Supabase connection failed: $($_.Exception.Message)"
        return $false
    }
}

# Build and start container
function Start-Container {
    Write-Status "info" "Building and starting Docker container..."
    
    try {
        # Stop any existing containers
        docker-compose down 2>$null
        
        # Build container
        Write-Status "info" "Building container..."
        docker-compose build --no-cache
        
        # Start container
        Write-Status "info" "Starting container..."
        docker-compose up -d
        
        # Wait for container to be ready
        Write-Status "info" "Waiting for container to be ready..."
        Start-Sleep -Seconds 15
        
        return $true
    }
    catch {
        Write-Status "error" "Failed to start container: $($_.Exception.Message)"
        return $false
    }
}

# Verify deployment
function Test-Deployment {
    Write-Status "info" "Verifying deployment..."
    
    $maxAttempts = 30
    $attempt = 1
    
    while ($attempt -le $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                $healthData = $response.Content | ConvertFrom-Json
                Write-Status "success" "Container is responding"
                
                # Check Supabase status
                if ($healthData.checks.supabase -eq "connected") {
                    Write-Status "success" "Supabase connection verified"
                }
                elseif ($healthData.checks.supabase -eq "not_configured") {
                    Write-Status "error" "Supabase not configured in container"
                    return $false
                }
                else {
                    Write-Status "warning" "Supabase status: $($healthData.checks.supabase)"
                }
                
                return $true
            }
        }
        catch {
            # Continue trying
        }
        
        Write-Status "info" "Waiting for container... (attempt $attempt/$maxAttempts)"
        Start-Sleep -Seconds 2
        $attempt++
    }
    
    Write-Status "error" "Container failed to start within expected time"
    return $false
}

# Main execution
function Main {
    # Check Docker
    if (-not (Test-Docker)) {
        exit 1
    }
    
    # Setup environment
    if (-not (Setup-Environment)) {
        exit 1
    }
    
    # Test Supabase connection
    if (-not (Test-SupabaseConnection)) {
        Write-Status "warning" "Supabase connection test failed, but continuing..."
    }
    
    # Start container
    if (-not (Start-Container)) {
        exit 1
    }
    
    # Verify deployment
    if (-not (Test-Deployment)) {
        Write-Status "error" "Deployment verification failed"
        Write-Status "info" "Run .\scripts\docker-debug.ps1 for detailed troubleshooting"
        exit 1
    }
    
    Write-Host ""
    Write-Status "success" "Docker Supabase setup completed successfully!"
    Write-Status "info" "Your application is running at: http://localhost:3000"
    Write-Status "info" "Health check: http://localhost:3000/api/health"
    Write-Status "info" "For troubleshooting, run: .\scripts\docker-debug.ps1"
}

# Run main function
Main 