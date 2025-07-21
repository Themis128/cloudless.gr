# Development Docker Supabase Setup Script for Cloudless LLM Dev Agent
# This script helps quickly set up Docker development environment with proper Supabase connection

param(
    [string]$SupabaseUrl,
    [string]$SupabaseAnonKey,
    [string]$SupabaseServiceKey,
    [switch]$Force,
    [switch]$WithDatabase,
    [switch]$WithEmail,
    [switch]$WithRedis
)

# Colors for output (used in Write-Status function)
$script:Red = [System.ConsoleColor]::Red
$script:Green = [System.ConsoleColor]::Green
$script:Yellow = [System.ConsoleColor]::Yellow
$script:Blue = [System.ConsoleColor]::Blue
$script:Cyan = [System.ConsoleColor]::Cyan

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

Write-Host "🐳 Development Docker Supabase Setup for Cloudless LLM Dev Agent" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

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

# Setup development environment file
function Initialize-DevelopmentEnvironment {
    Write-Status "info" "Setting up development environment configuration..."
    
    # Check if .env already exists
    if (Test-Path ".env") {
        if (-not $Force) {
            Write-Status "warning" ".env file already exists"
            $response = Read-Host "Do you want to overwrite it? (y/N)"
            if ($response -ne "y" -and $response -ne "Y") {
                Write-Status "info" "Skipping .env creation"
                return $true
            }
        }
    }
    
    # Copy development template
    if (Test-Path "docker.dev.env.example") {
        Copy-Item "docker.dev.env.example" ".env"
        Write-Status "success" "Created .env from development template"
    }
    else {
        Write-Status "error" "docker.dev.env.example not found"
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

# Build and start development container
function Start-DevelopmentContainer {
    Write-Status "info" "Building and starting Docker development container..."
    
    try {
        # Stop any existing containers
        docker-compose -f docker-compose.dev.yml down 2>$null
        
        # Build development container
        Write-Status "info" "Building development container..."
        docker-compose -f docker-compose.dev.yml build --no-cache
        
        # Determine which services to start
        $services = @("app-dev", "redis-dev")
        
        if ($WithDatabase) {
            $services += "postgres-dev"
            Write-Status "info" "Including local PostgreSQL database"
        }
        
        if ($WithEmail) {
            $services += "mailhog"
            Write-Status "info" "Including Mailhog for email testing"
        }
        
        if ($WithRedis) {
            $services += "redis-commander"
            Write-Status "info" "Including Redis Commander"
        }
        
        # Start services
        Write-Status "info" "Starting development services: $($services -join ', ')"
        docker-compose -f docker-compose.dev.yml up -d $services
        
        # Wait for container to be ready
        Write-Status "info" "Waiting for development container to be ready..."
        Start-Sleep -Seconds 20
        
        return $true
    }
    catch {
        Write-Status "error" "Failed to start development container: $($_.Exception.Message)"
        return $false
    }
}

# Verify development deployment
function Test-DevelopmentDeployment {
    Write-Status "info" "Verifying development deployment..."
    
    $maxAttempts = 30
    $attempt = 1
    
    while ($attempt -le $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                $healthData = $response.Content | ConvertFrom-Json
                Write-Status "success" "Development container is responding"
                
                # Check environment
                if ($healthData.config.nodeEnv -eq "development") {
                    Write-Status "success" "Development environment confirmed"
                }
                
                # Check Supabase status
                if ($healthData.checks.supabase -eq "connected") {
                    Write-Status "success" "Supabase connection verified"
                }
                elseif ($healthData.checks.supabase -eq "not_configured") {
                    Write-Status "error" "Supabase not configured in development container"
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
        
        Write-Status "info" "Waiting for development container... (attempt $attempt/$maxAttempts)"
        Start-Sleep -Seconds 2
        $attempt++
    }
    
    Write-Status "error" "Development container failed to start within expected time"
    return $false
}

# Show development URLs
function Show-DevelopmentUrls {
    Write-Host ""
    Write-Status "header" "Development Environment URLs"
    Write-Host "=====================================" -ForegroundColor Cyan
    
    Write-Status "success" "Main Application: http://localhost:3000"
    Write-Status "info" "Health Check: http://localhost:3000/api/health"
    Write-Status "info" "Node.js Debugger: http://localhost:9229"
    
    if ($WithDatabase) {
        Write-Status "info" "Adminer (Database): http://localhost:8080"
    }
    
    if ($WithEmail) {
        Write-Status "info" "Mailhog (Email): http://localhost:8025"
    }
    
    if ($WithRedis) {
        Write-Status "info" "Redis Commander: http://localhost:8081"
    }
    
    Write-Host ""
    Write-Status "info" "Development Tools:"
    Write-Host "  - Hot reloading enabled" -ForegroundColor Green
    Write-Host "  - Debug mode enabled" -ForegroundColor Green
    Write-Host "  - Source maps enabled" -ForegroundColor Green
    Write-Host "  - File watching enabled" -ForegroundColor Green
}

# Main execution
function Main {
    # Check Docker
    if (-not (Test-Docker)) {
        exit 1
    }
    
    # Setup environment
    if (-not (Initialize-DevelopmentEnvironment)) {
        exit 1
    }
    
    # Test Supabase connection
    if (-not (Test-SupabaseConnection)) {
        Write-Status "warning" "Supabase connection test failed, but continuing..."
    }
    
    # Start development container
    if (-not (Start-DevelopmentContainer)) {
        exit 1
    }
    
    # Verify deployment
    if (-not (Test-DevelopmentDeployment)) {
        Write-Status "error" "Development deployment verification failed"
        Write-Status "info" "Run .\scripts\docker-debug.ps1 for detailed troubleshooting"
        exit 1
    }
    
    # Show URLs
    Show-DevelopmentUrls
    
    Write-Host ""
    Write-Status "success" "Development Docker Supabase setup completed successfully!"
    Write-Status "info" "For troubleshooting, run: .\scripts\docker-debug.ps1"
    Write-Status "info" "To view logs: docker-compose -f docker-compose.dev.yml logs -f app-dev"
}

# Run main function
Main 