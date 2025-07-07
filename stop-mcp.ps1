#!/usr/bin/env pwsh
# Stop MCP Server Script
# This script stops any running Supabase MCP server processes

Write-Host "🛑 Stopping Supabase MCP Server..." -ForegroundColor Yellow

try {
    # Find MCP server processes
    $mcpProcesses = Get-Process | Where-Object {
        $_.ProcessName -eq "node" -and 
        (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)" | 
         Select-Object -ExpandProperty CommandLine) -like "*@supabase/mcp-server-supabase*"
    }

    if ($mcpProcesses.Count -gt 0) {
        Write-Host "📋 Found $($mcpProcesses.Count) MCP server process(es)" -ForegroundColor Cyan
        
        foreach ($process in $mcpProcesses) {
            Write-Host "  - Stopping process ID: $($process.Id)" -ForegroundColor Gray
            $process | Stop-Process -Force
        }
        
        Write-Host "✅ MCP server stopped successfully" -ForegroundColor Green
    } else {
        Write-Host "ℹ️ No MCP server processes found running" -ForegroundColor Blue
    }
    
    # Also try to kill any npx processes running the MCP server
    $npxProcesses = Get-Process | Where-Object {
        $_.ProcessName -eq "node" -and 
        (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)" | 
         Select-Object -ExpandProperty CommandLine) -like "*npx*supabase*"
    }
    
    if ($npxProcesses.Count -gt 0) {
        Write-Host "📋 Found $($npxProcesses.Count) npx MCP process(es)" -ForegroundColor Cyan
        $npxProcesses | Stop-Process -Force
        Write-Host "✅ npx MCP processes stopped" -ForegroundColor Green
    }

} catch {
    Write-Host "❌ Error stopping MCP server: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "🏁 MCP server stop operation completed" -ForegroundColor Green
