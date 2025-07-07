#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Start Supabase MCP Server with local environment
.DESCRIPTION
    Loads environment variables from .env and starts the MCP server
#>

param(
    [switch]$Test,
    [switch]$Verbose
)

Write-Host "🚀 Starting Supabase MCP Server" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

# Load environment variables from .env file
if (Test-Path ".env") {
    Write-Host "📝 Loading environment variables from .env..." -ForegroundColor Yellow
    
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            
            # Skip empty lines and comments
            if ($name -and -not $name.StartsWith('#')) {
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
                if ($Verbose) {
                    Write-Host "   Set $name" -ForegroundColor Gray
                }
            }
        }
    }
    
    Write-Host "✅ Environment variables loaded" -ForegroundColor Green
} else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
    exit 1
}

# Test mode - just verify environment
if ($Test) {
    Write-Host "`n🔍 Testing environment variables:" -ForegroundColor Yellow
    
    $requiredVars = @(
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY", 
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ACCESS_TOKEN"
    )
    
    $allSet = $true
    foreach ($var in $requiredVars) {
        $value = [Environment]::GetEnvironmentVariable($var, "Process")
        if ($value) {
            Write-Host "   ✅ $var = $($value.Substring(0, [Math]::Min(20, $value.Length)))..." -ForegroundColor Green
        } else {
            Write-Host "   ❌ $var = (not set)" -ForegroundColor Red
            $allSet = $false
        }
    }
    
    if ($allSet) {
        Write-Host "`n🎉 All environment variables are set!" -ForegroundColor Green
    } else {
        Write-Host "`n💥 Missing required environment variables!" -ForegroundColor Red
        exit 1
    }
    
    exit 0
}

# Start the MCP server
Write-Host "`n🚀 Starting MCP server..." -ForegroundColor Yellow
Write-Host "   Command: npx @supabase/mcp-server-supabase" -ForegroundColor Gray
Write-Host "   Supabase URL: $($env:SUPABASE_URL)" -ForegroundColor Gray

try {
    npx '@supabase/mcp-server-supabase'
} catch {
    Write-Host "`n❌ Failed to start MCP server: $_" -ForegroundColor Red
    exit 1
}
