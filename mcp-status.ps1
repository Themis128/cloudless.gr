#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Comprehensive MCP Status Check
#>

Write-Host "🔧 MCP Integration Status" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

# Check if MCP server is running
Write-Host "🔍 Checking MCP Server Process..." -ForegroundColor Yellow
try {
    $mcpProcesses = Get-Process | Where-Object {
        $_.ProcessName -eq "node" -and 
        (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)" | 
         Select-Object -ExpandProperty CommandLine) -like "*@supabase/mcp-server-supabase*"
    }

    if ($mcpProcesses.Count -gt 0) {
        Write-Host "✅ MCP Server: Running ($($mcpProcesses.Count) process(es))" -ForegroundColor Green
        foreach ($process in $mcpProcesses) {
            $startTime = $process.StartTime
            $uptime = (Get-Date) - $startTime
            Write-Host "   📊 Process ID: $($process.Id), Uptime: $($uptime.ToString('hh\:mm\:ss'))" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ MCP Server: Not Running" -ForegroundColor Red
        Write-Host "   Start with: npm run mcp:start" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️ Could not check MCP process status" -ForegroundColor Yellow
}

Write-Host ""

# Check Supabase connection
Write-Host "🔍 Checking Supabase Connection..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "http://192.168.0.23:54321/rest/v1/" -Method GET -Headers @{
        "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    } -TimeoutSec 5 -ErrorAction Stop | Out-Null

    Write-Host "✅ Supabase Connection: Running (192.168.0.23:54321)" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase Connection: Failed" -ForegroundColor Red
    Write-Host "   Start with: npx supabase start" -ForegroundColor Gray
}

# Check MCP config file
Write-Host "🔍 Checking MCP Configuration..." -ForegroundColor Yellow
if (Test-Path ".vscode/mcp.json") {
    Write-Host "✅ MCP Configuration: Found (.vscode/mcp.json)" -ForegroundColor Green
} else {
    Write-Host "❌ MCP Configuration: Missing" -ForegroundColor Red
}

# Check environment variables
Write-Host "🔍 Checking Environment..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ Environment File: Found (.env)" -ForegroundColor Green
} else {
    Write-Host "❌ Environment File: Missing" -ForegroundColor Red
}

Write-Host ""
if ($mcpProcesses.Count -gt 0) {
    Write-Host "🚀 MCP integration is ready!" -ForegroundColor Green
    Write-Host "   Configure your AI assistant to use: .vscode/mcp.json" -ForegroundColor Gray
} else {
    Write-Host "⚠️ MCP server needs to be started" -ForegroundColor Yellow
    Write-Host "   Run: npm run mcp:start" -ForegroundColor Gray
}
