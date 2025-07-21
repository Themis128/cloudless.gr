# Docker Debug Script for Cloudless LLM Dev Agent (PowerShell)
# This script helps debug Docker container issues, especially Supabase connectivity

param(
    [switch]$Verbose
)

# Function to print colored output
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
    }
}

Write-Host "🔍 Docker Debug Script for Cloudless LLM Dev Agent" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check if Docker is running
function Test-Docker {
    Write-Status "info" "Checking Docker status..."
    try {
        docker info | Out-Null
        Write-Status "success" "Docker is running"
    }
    catch {
        Write-Status "error" "Docker is not running or not accessible"
        exit 1
    }
}

# Check if .env file exists
function Test-EnvFile {
    Write-Status "info" "Checking environment file..."
    if (-not (Test-Path ".env")) {
        Write-Status "error" ".env file not found"
        Write-Status "info" "Please copy docker.env.example to .env and configure your Supabase credentials"
        exit 1
    }
    Write-Status "success" ".env file found"
}

# Validate environment variables
function Test-EnvVariables {
    Write-Status "info" "Validating environment variables..."
    
    # Load .env file
    if (Test-Path ".env") {
        Get-Content ".env" | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $name = $matches[1]
                $value = $matches[2]
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    }
    
    $missingVars = @()
    
    if (-not $env:NUXT_PUBLIC_SUPABASE_URL) {
        $missingVars += "NUXT_PUBLIC_SUPABASE_URL"
    }
    
    if (-not $env:NUXT_PUBLIC_SUPABASE_ANON_KEY) {
        $missingVars += "NUXT_PUBLIC_SUPABASE_ANON_KEY"
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Status "error" "Missing required environment variables:"
        foreach ($var in $missingVars) {
            Write-Host "  - $var"
        }
        exit 1
    }
    
    Write-Status "success" "All required environment variables are set"
}

# Check container status
function Test-ContainerStatus {
    Write-Status "info" "Checking container status..."
    
    $container = docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "cloudlessgr-app"
    
    if ($container) {
        Write-Status "success" "Container is running"
        Write-Host $container
    }
    else {
        Write-Status "warning" "Container is not running"
        Write-Status "info" "Starting container..."
        docker-compose up -d
        Start-Sleep -Seconds 10
    }
}

# Test container connectivity
function Test-ContainerConnectivity {
    Write-Status "info" "Testing container connectivity..."
    
    $maxAttempts = 30
    $attempt = 1
    
    while ($attempt -le $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Status "success" "Container is responding to health checks"
                break
            }
        }
        catch {
            # Continue trying
        }
        
        Write-Status "info" "Waiting for container to be ready... (attempt $attempt/$maxAttempts)"
        Start-Sleep -Seconds 2
        $attempt++
    }
    
    if ($attempt -gt $maxAttempts) {
        Write-Status "error" "Container failed to start within expected time"
        return $false
    }
    
    return $true
}

# Get detailed health check
function Get-HealthCheck {
    Write-Status "info" "Getting detailed health check..."
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 10
        $healthData = $response.Content | ConvertFrom-Json
        
        Write-Host "Health Check Response:"
        $healthData | ConvertTo-Json -Depth 10
    }
    catch {
        Write-Status "error" "Failed to get health check response"
        Write-Host $_.Exception.Message
    }
}

# Check container logs
function Get-ContainerLogs {
    Write-Status "info" "Checking container logs..."
    
    Write-Host "Recent container logs:"
    try {
        docker logs --tail 50 cloudlessgr-app 2>$null
    }
    catch {
        $containerId = docker ps -q --filter "name=cloudlessgr-app" 2>$null
        if ($containerId) {
            docker logs --tail 50 $containerId 2>$null
        }
    }
}

# Test Supabase connectivity from container
function Test-SupabaseConnectivity {
    Write-Status "info" "Testing Supabase connectivity from container..."
    
    $testScript = @"
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Supabase environment variables not set in container');
    process.exit(1);
}

console.log('🔍 Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey.substring(0, 10) + '...');

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

supabase.rpc('version')
    .then(({ data, error }) => {
        if (error) {
            console.log('❌ Supabase connection failed:', error.message);
            process.exit(1);
        } else {
            console.log('✅ Supabase connection successful');
            console.log('Version:', data);
        }
    })
    .catch(err => {
        console.log('❌ Supabase connection error:', err.message);
        process.exit(1);
    });
"@

    try {
        docker exec cloudlessgr-app node -e $testScript 2>$null
    }
    catch {
        Write-Status "error" "Failed to test Supabase connectivity"
        Write-Host $_.Exception.Message
    }
}

# Main execution
function Main {
    Write-Host ""
    Test-Docker
    Write-Host ""
    Test-EnvFile
    Write-Host ""
    Test-EnvVariables
    Write-Host ""
    Test-ContainerStatus
    Write-Host ""
    
    if (Test-ContainerConnectivity) {
        Write-Host ""
        Get-HealthCheck
        Write-Host ""
        Get-ContainerLogs
        Write-Host ""
        Test-SupabaseConnectivity
    }
    
    Write-Host ""
    Write-Status "success" "Debug script completed"
    Write-Status "info" "If issues persist, check the logs above for specific error messages"
}

# Run main function
Main 