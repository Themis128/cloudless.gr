#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Test MCP (Model Context Protocol) integration with local Supabase
.DESCRIPTION
    This script tests the MCP server setup and verifies connectivity
#>

param(
    [switch]$TestLocal,
    [switch]$TestSelfHosted,
    [switch]$TestAll
)

# Configuration
$PROJECT_ROOT = $PSScriptRoot
$MCP_CONFIG = Join-Path $PROJECT_ROOT "mcp-config.json"

Write-Host "🧪 MCP Test Suite" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan

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

function Test-MCPLocalServer {
    Write-Host "🧪 Testing Local MCP Server..." -ForegroundColor Yellow
    
    $localServerPath = Join-Path $PROJECT_ROOT "supabase-mcp-main/supabase-mcp-main/packages/mcp-server-supabase/dist/transports/stdio.js"
    
    if (-not (Test-Path $localServerPath)) {
        Write-Host "❌ Local MCP server not found at: $localServerPath" -ForegroundColor Red
        return $false
    }
    
    try {
        Write-Host "   Starting local MCP server..." -ForegroundColor Gray
        
        # Set environment variables
        $env:SUPABASE_URL = "http://localhost:54321"
        $env:SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        $env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
        
        # Test if the server starts without errors (quick test)
        $testInput = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
        $process = Start-Process -FilePath "node" -ArgumentList $localServerPath -NoNewWindow -PassThru -RedirectStandardInput -RedirectStandardOutput -RedirectStandardError
        
        Start-Sleep -Seconds 2
        
        if (-not $process.HasExited) {
            $process.Kill()
            Write-Host "✅ Local MCP server starts successfully!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Local MCP server failed to start" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Error testing local MCP server: $_" -ForegroundColor Red
        return $false
    }
    finally {
        # Clean up environment variables
        Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
        Remove-Item Env:SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
        Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
    }
}

function Test-MCPSelfHostedServer {
    Write-Host "🧪 Testing Self-Hosted MCP Server..." -ForegroundColor Yellow
    
    $selfHostedPath = Join-Path $PROJECT_ROOT "node_modules/self-hosted-supabase-mcp/dist/index.js"
    
    if (-not (Test-Path $selfHostedPath)) {
        Write-Host "❌ Self-hosted MCP server not found. Install with: npm install self-hosted-supabase-mcp" -ForegroundColor Red
        return $false
    }
    
    try {
        Write-Host "   Testing self-hosted MCP server..." -ForegroundColor Gray
        
        # Quick test to see if the server starts
        $process = Start-Process -FilePath "node" -ArgumentList @(
            $selfHostedPath,
            "--url", "http://localhost:54321",
            "--anon-key", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        ) -NoNewWindow -PassThru
        
        Start-Sleep -Seconds 3
        
        if (-not $process.HasExited) {
            $process.Kill()
            Write-Host "✅ Self-hosted MCP server starts successfully!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Self-hosted MCP server failed to start" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Error testing self-hosted MCP server: $_" -ForegroundColor Red
        return $false
    }
}

function Test-MCPConfiguration {
    Write-Host "🧪 Testing MCP configuration..." -ForegroundColor Yellow
    
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

function Show-MCPStatus {
    Write-Host "`n📊 MCP Integration Status" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan
    
    Write-Host "Configuration File: " -NoNewline -ForegroundColor Gray
    if (Test-Path $MCP_CONFIG) {
        Write-Host "✅ Found" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing" -ForegroundColor Red
    }
    
    Write-Host "Local MCP Server:   " -NoNewline -ForegroundColor Gray
    $localPath = Join-Path $PROJECT_ROOT "supabase-mcp-main/supabase-mcp-main/packages/mcp-server-supabase/dist/transports/stdio.js"
    if (Test-Path $localPath) {
        Write-Host "✅ Built" -ForegroundColor Green
    } else {
        Write-Host "❌ Not Built" -ForegroundColor Red
    }
    
    Write-Host "Self-Hosted Server: " -NoNewline -ForegroundColor Gray
    $selfHostedPath = Join-Path $PROJECT_ROOT "node_modules/self-hosted-supabase-mcp/dist/index.js"
    if (Test-Path $selfHostedPath) {
        Write-Host "✅ Installed" -ForegroundColor Green
    } else {
        Write-Host "❌ Not Installed" -ForegroundColor Red
    }
}

# Main execution
if (-not ($TestLocal -or $TestSelfHosted -or $TestAll)) {
    Show-MCPStatus
    Write-Host "`nUsage: .\test-mcp.ps1 [-TestLocal] [-TestSelfHosted] [-TestAll]" -ForegroundColor Gray
    exit 0
}

$allTestsPassed = $true

# Always test Supabase connection first
$allTestsPassed = (Test-SupabaseConnection) -and $allTestsPassed

# Test configuration
$allTestsPassed = (Test-MCPConfiguration) -and $allTestsPassed

if ($TestLocal -or $TestAll) {
    $allTestsPassed = (Test-MCPLocalServer) -and $allTestsPassed
}

if ($TestSelfHosted -or $TestAll) {
    $allTestsPassed = (Test-MCPSelfHostedServer) -and $allTestsPassed
}

Write-Host "`n" -NoNewline
if ($allTestsPassed) {
    Write-Host "🎉 All tests passed! MCP integration is ready." -ForegroundColor Green
} else {
    Write-Host "💥 Some tests failed. Check the output above." -ForegroundColor Red
    exit 1
}

Write-Host "🏁 Test suite completed!" -ForegroundColor Cyan
