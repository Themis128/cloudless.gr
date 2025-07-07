#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Setup MCP (Model Context Protocol) integration for local Supabase
.DESCRIPTION
    This script installs and configures MCP servers for AI assistant integration
    with the local Supabase instance running on localhost:54321
#>

param(
    [switch]$Install,
    [switch]$Start,
    [switch]$Test,
    [switch]$Clean
)

# Configuration
$PROJECT_ROOT = $PSScriptRoot
$MCP_CONFIG = Join-Path $PROJECT_ROOT "mcp-config.json"
$MCP_TOOLS_DIR = Join-Path $PROJECT_ROOT "mcp-tools"

Write-Host "🔧 Supabase MCP Setup Script" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

function Install-MCPServers {
    Write-Host "📦 Installing MCP servers..." -ForegroundColor Yellow
    
    try {
        # Install self-hosted Supabase MCP server
        Write-Host "Installing self-hosted-supabase-mcp..." -ForegroundColor Gray
        npm install self-hosted-supabase-mcp --save-dev
        
        # Install official Supabase MCP server globally for npx usage
        Write-Host "Installing @supabase/mcp-server-supabase..." -ForegroundColor Gray
        npm install -g @supabase/mcp-server-supabase
        
        Write-Host "✅ MCP servers installed successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Failed to install MCP servers: $_" -ForegroundColor Red
        return $false
    }
}

function Test-SupabaseConnection {
    Write-Host "🔍 Testing Supabase connection..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:54321/rest/v1/" -Method GET -Headers @{
            "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        } -TimeoutSec 10
        
        Write-Host "✅ Supabase is running and accessible!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Cannot connect to Supabase at localhost:54321" -ForegroundColor Red
        Write-Host "   Make sure Supabase is running with: npx supabase start" -ForegroundColor Gray
        return $false
    }
}

function Test-DatabaseConnection {
    Write-Host "🔍 Testing database connection..." -ForegroundColor Yellow
    
    try {
        # Test PostgreSQL connection
        $env:PGPASSWORD = "postgres"
        $result = psql -h localhost -p 54322 -U postgres -d postgres -c "SELECT version();" 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database connection successful!" -ForegroundColor Green
            return $true
        } else {
            throw "psql command failed"
        }
    }
    catch {
        Write-Host "❌ Cannot connect to database at localhost:54322" -ForegroundColor Red
        Write-Host "   Make sure PostgreSQL is running via Supabase" -ForegroundColor Gray
        return $false
    }
    finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

function Start-MCPServer {
    param([string]$ServerName = "self-hosted-supabase")
    
    Write-Host "🚀 Starting MCP server: $ServerName" -ForegroundColor Yellow
    
    if ($ServerName -eq "self-hosted-supabase") {
        $command = "node"
        $args = @(
            "node_modules/self-hosted-supabase-mcp/dist/index.js",
            "--url", "http://localhost:54321",
            "--anon-key", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
            "--db-url", "postgresql://postgres:postgres@localhost:54322/postgres",
            "--service-key", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
            "--jwt-secret", "super-secret-jwt-token-with-at-least-32-characters-long"
        )
        
        Write-Host "Command: $command $($args -join ' ')" -ForegroundColor Gray
        Start-Process -FilePath $command -ArgumentList $args -NoNewWindow
    }
    elseif ($ServerName -eq "supabase-enhanced") {
        $env:SUPABASE_URL = "http://localhost:54321"
        $env:SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        $env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
        
        $command = "npx"
        $args = @("-y", "@supabase/mcp-server-supabase@latest", "--features=database,debug,development,docs")
        
        Write-Host "Command: $command $($args -join ' ')" -ForegroundColor Gray
        Start-Process -FilePath $command -ArgumentList $args -NoNewWindow
    }
}

function Test-MCPConfiguration {
    Write-Host "🔍 Testing MCP configuration..." -ForegroundColor Yellow
    
    if (-not (Test-Path $MCP_CONFIG)) {
        Write-Host "❌ MCP config file not found: $MCP_CONFIG" -ForegroundColor Red
        return $false
    }
    
    try {
        $config = Get-Content $MCP_CONFIG | ConvertFrom-Json
        
        if ($config.mcpServers) {
            Write-Host "✅ MCP configuration is valid!" -ForegroundColor Green
            Write-Host "   Configured servers:" -ForegroundColor Gray
            $config.mcpServers.PSObject.Properties | ForEach-Object {
                Write-Host "   - $($_.Name)" -ForegroundColor Gray
            }
            return $true
        } else {
            Write-Host "❌ Invalid MCP configuration structure" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Failed to parse MCP configuration: $_" -ForegroundColor Red
        return $false
    }
}

function Clean-MCPInstallation {
    Write-Host "🧹 Cleaning MCP installation..." -ForegroundColor Yellow
    
    try {
        # Remove installed packages
        if (Test-Path "node_modules/self-hosted-supabase-mcp") {
            npm uninstall self-hosted-supabase-mcp
        }
        
        # Clean npm cache
        npm cache clean --force
        
        Write-Host "✅ MCP installation cleaned!" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed to clean MCP installation: $_" -ForegroundColor Red
    }
}

function Show-Usage {
    Write-Host @"
Usage: .\setup-mcp.ps1 [OPTIONS]

Options:
  -Install    Install MCP servers and dependencies
  -Start      Start MCP servers
  -Test       Test MCP configuration and connections
  -Clean      Clean MCP installation

Examples:
  .\setup-mcp.ps1 -Install -Test
  .\setup-mcp.ps1 -Start
  .\setup-mcp.ps1 -Clean

"@ -ForegroundColor Gray
}

# Main execution
if (-not ($Install -or $Start -or $Test -or $Clean)) {
    Show-Usage
    exit 0
}

if ($Install) {
    if (Install-MCPServers) {
        Write-Host "🎉 Installation completed!" -ForegroundColor Green
    } else {
        Write-Host "💥 Installation failed!" -ForegroundColor Red
        exit 1
    }
}

if ($Test) {
    $allTestsPassed = $true
    
    $allTestsPassed = (Test-SupabaseConnection) -and $allTestsPassed
    $allTestsPassed = (Test-DatabaseConnection) -and $allTestsPassed
    $allTestsPassed = (Test-MCPConfiguration) -and $allTestsPassed
    
    if ($allTestsPassed) {
        Write-Host "🎉 All tests passed! MCP is ready to use." -ForegroundColor Green
    } else {
        Write-Host "💥 Some tests failed. Check the output above." -ForegroundColor Red
        exit 1
    }
}

if ($Start) {
    Start-MCPServer -ServerName "self-hosted-supabase"
    Write-Host "🚀 MCP server started!" -ForegroundColor Green
}

if ($Clean) {
    Clean-MCPInstallation
}

Write-Host "🏁 Setup script completed!" -ForegroundColor Cyan
