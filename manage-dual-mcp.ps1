# Dual MCP Server Management Script
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('start', 'stop', 'status', 'restart')]
    [string]$Action
)

$ErrorActionPreference = "SilentlyContinue"

# MCP Server configurations
$McpServers = @{
    "Database" = @{
        Name = "Supabase Database MCP"
        Command = "npx @supabase/mcp-server-supabase@latest --read-only"
        ProcessName = "supabase"
        Port = $null
        Description = "Database operations and queries"
    }
    "Development" = @{
        Name = "Nuxt Development MCP"
        Command = "node mcp-tools/nuxt-dev-server.js"
        ProcessName = "nuxt-dev-server"
        Port = $null
        Description = "Nuxt scaffolding and development tools"
    }
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    $colors = @{
        "Red" = [ConsoleColor]::Red
        "Green" = [ConsoleColor]::Green
        "Yellow" = [ConsoleColor]::Yellow
        "Blue" = [ConsoleColor]::Blue
        "Cyan" = [ConsoleColor]::Cyan
        "Magenta" = [ConsoleColor]::Magenta
        "White" = [ConsoleColor]::White
        "Gray" = [ConsoleColor]::Gray
    }
    
    # Ensure we have a valid color, default to White if not found
    $targetColor = $colors[$Color]
    if (-not $targetColor) {
        $targetColor = [ConsoleColor]::White
    }
    
    Write-Host $Message -ForegroundColor $targetColor
}

function Get-McpProcesses {
    param([string]$ProcessFilter = "*")
    
    $processes = @()
    
    # Get Node.js processes that might be MCP servers
    $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        ($_.CommandLine -like "*mcp*" -or 
         $_.CommandLine -like "*supabase*" -or
         $_.CommandLine -like "*nuxt-dev-server*" -or
         $_.CommandLine -like "*mcp-tools*") -and
        $_.CommandLine -notlike "*npm*" -and
        $_.CommandLine -notlike "*mcp:status*"
    }
    
    foreach ($proc in $nodeProcesses) {
        $commandLine = ""
        try {
            $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            # Debug: Show what we found
            # Write-Host "Debug: Process $($proc.Id): $commandLine" -ForegroundColor Gray
        } catch {
            $commandLine = "Unknown"
        }
        
        $serverType = "Unknown"
        if ($commandLine -like "*npm*" -or $commandLine -like "*mcp:status*") {
            # Skip npm processes running status commands
            continue
        } elseif ($commandLine -like "*supabase*") {
            $serverType = "Database"
        } elseif ($commandLine -like "*nuxt-dev-server*") {
            $serverType = "Development"
        } elseif ($commandLine -like "*mcp-tools*") {
            $serverType = "Development"
        } elseif ($commandLine -like "*nuxt*" -and $commandLine -like "*mcp*") {
            $serverType = "Development"
        }
        
        $processes += [PSCustomObject]@{
            Id = $proc.Id
            Name = $proc.ProcessName
            Type = $serverType
            CommandLine = $commandLine
            StartTime = $proc.StartTime
            CPU = $proc.CPU
            Memory = [math]::Round($proc.WorkingSet64 / 1MB, 2)
        }
    }
    
    return $processes
}

function Start-McpServers {
    Write-ColorOutput "🚀 Starting Dual MCP Server Setup..." "Cyan"
    Write-ColorOutput "=========================================" "Cyan"
    
    foreach ($serverKey in $McpServers.Keys) {
        $server = $McpServers[$serverKey]
        Write-ColorOutput "`n📡 Starting $($server.Name)..." "Yellow"
        Write-ColorOutput "   Description: $($server.Description)" "White"
        Write-ColorOutput "   Command: $($server.Command)" "Gray"
        
        try {
            # Start the process in background
            $startInfo = New-Object System.Diagnostics.ProcessStartInfo
            $startInfo.FileName = "cmd"
            $startInfo.Arguments = "/c $($server.Command)"
            $startInfo.WorkingDirectory = (Get-Location).Path
            $startInfo.UseShellExecute = $false
            $startInfo.CreateNoWindow = $true
            $startInfo.RedirectStandardOutput = $true
            $startInfo.RedirectStandardError = $true
            
            $process = New-Object System.Diagnostics.Process
            $process.StartInfo = $startInfo
            $process.Start() | Out-Null
            
            Start-Sleep -Milliseconds 500
            
            if (-not $process.HasExited) {
                Write-ColorOutput "   ✅ Started successfully (PID: $($process.Id))" "Green"
            } else {
                Write-ColorOutput "   ❌ Failed to start" "Red"
            }
        } catch {
            Write-ColorOutput "   ❌ Error starting server: $($_.Exception.Message)" "Red"
        }
    }
    
    Write-ColorOutput "`n⏳ Waiting for servers to initialize..." "Yellow"
    Start-Sleep -Seconds 2
    
    Show-McpStatus
}

function Stop-McpServers {
    Write-ColorOutput "🛑 Stopping MCP Servers..." "Yellow"
    Write-ColorOutput "===========================" "Yellow"
    
    $processes = Get-McpProcesses
    
    if ($processes.Count -eq 0) {
        Write-ColorOutput "   ℹ️ No MCP servers are currently running" "Blue"
        return
    }
    
    foreach ($process in $processes) {
        Write-ColorOutput "`n🔄 Stopping $($process.Type) MCP Server (PID: $($process.Id))..." "Yellow"
        
        try {
            Stop-Process -Id $process.Id -Force
            Write-ColorOutput "   ✅ Stopped successfully" "Green"
        } catch {
            Write-ColorOutput "   ❌ Error stopping process: $($_.Exception.Message)" "Red"
        }
    }
    
    Start-Sleep -Seconds 1
    
    # Verify all stopped
    $remainingProcesses = Get-McpProcesses
    if ($remainingProcesses.Count -eq 0) {
        Write-ColorOutput "`n✅ All MCP servers stopped successfully" "Green"
    } else {
        Write-ColorOutput "`n⚠️ Some processes may still be running" "Yellow"
    }
}

function Show-McpStatus {
    Write-ColorOutput "📊 MCP Server Status Report" "Cyan"
    Write-ColorOutput "============================" "Cyan"
    
    $processes = Get-McpProcesses
    
    if ($processes.Count -eq 0) {
        Write-ColorOutput "`n❌ No MCP servers are currently running" "Red"
        Write-ColorOutput "`nTo start servers, run: .\manage-dual-mcp.ps1 start" "Yellow"
        return
    }
    
    foreach ($process in $processes) {
        $uptime = if ($process.StartTime) {
            $runtime = (Get-Date) - $process.StartTime
            "$($runtime.Hours)h $($runtime.Minutes)m $($runtime.Seconds)s"
        } else {
            "Unknown"
        }
        
        Write-ColorOutput "`n🟢 $($process.Type) MCP Server" "Green"
        Write-ColorOutput "   Process ID: $($process.Id)" "White"
        Write-ColorOutput "   Memory Usage: $($process.Memory) MB" "White"
        Write-ColorOutput "   CPU Time: $([math]::Round($process.CPU, 2)) seconds" "White"
        Write-ColorOutput "   Uptime: $uptime" "White"
        Write-ColorOutput "   Command: $($process.CommandLine)" "Gray"
    }
    
    # Check VS Code MCP configuration
    Write-ColorOutput "`n🔧 VS Code Integration Status:" "Cyan"
    
    $mcpConfigPath = ".vscode/mcp.json"
    if (Test-Path $mcpConfigPath) {
        Write-ColorOutput "   ✅ MCP configuration file exists" "Green"
        
        try {
            $mcpConfigContent = Get-Content $mcpConfigPath -Raw
            $mcpConfig = $mcpConfigContent | ConvertFrom-Json
            
            if ($mcpConfig.servers) {
                $serverNames = $mcpConfig.servers | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name
                $serverCount = $serverNames.Count
                Write-ColorOutput "   📡 Configured servers: $serverCount" "White"
                
                foreach ($serverName in $serverNames) {
                    Write-ColorOutput "      - $serverName" "Gray"
                }
            } else {
                Write-ColorOutput "   ⚠️ No servers section found in MCP configuration" "Yellow"
            }
        } catch {
            Write-ColorOutput "   ❌ Could not parse MCP configuration" "Red"
            Write-ColorOutput "      Error: $($_.Exception.Message)" "Red"
        }
    } else {
        Write-ColorOutput "   ❌ MCP configuration file not found" "Red"
    }
    
    # Environment check
    Write-ColorOutput "`n🌍 Environment Status:" "Cyan"
    $envVars = @(
        @{Name="SUPABASE_URL"; Description="Supabase URL"},
        @{Name="SUPABASE_ANON_KEY"; Description="Supabase Anonymous Key"},
        @{Name="SUPABASE_ACCESS_TOKEN"; Description="Supabase Service Role Key"},
        @{Name="SUPABASE_SERVICE_ROLE_KEY"; Description="Alternative Service Role Key"}
    )
    
    foreach ($envVar in $envVars) {
        $value = [Environment]::GetEnvironmentVariable($envVar.Name)
        if ($value) {
            $maskedValue = $value.Substring(0, [Math]::Min(10, $value.Length)) + "..."
            Write-ColorOutput "   ✅ $($envVar.Name): $maskedValue" "Green"
        } else {
            Write-ColorOutput "   ❌ $($envVar.Name): Not set" "Red"
        }
    }
    
    # Check if variables are set in current PowerShell session
    Write-ColorOutput "`n💡 Current Session Variables:" "Cyan"
    $sessionVars = @("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_ACCESS_TOKEN")
    $hasSessionVars = $false
    foreach ($varName in $sessionVars) {
        if (Test-Path "Env:\$varName") {
            $value = (Get-Item "Env:\$varName").Value
            $maskedValue = $value.Substring(0, [Math]::Min(10, $value.Length)) + "..."
            Write-ColorOutput "   ✅ $varName (session): $maskedValue" "Green"
            $hasSessionVars = $true
        }
    }
    if (-not $hasSessionVars) {
        Write-ColorOutput "   ℹ️ No session environment variables detected" "Blue"
        Write-ColorOutput "   💡 MCP servers get environment from VS Code configuration" "Blue"
    }
}

function Restart-McpServers {
    Write-ColorOutput "🔄 Restarting MCP Servers..." "Yellow"
    Stop-McpServers
    Start-Sleep -Seconds 2
    Start-McpServers
}

# Main execution
Write-ColorOutput "🎯 Dual MCP Server Manager" "Magenta"
Write-ColorOutput "===========================" "Magenta"

switch ($Action.ToLower()) {
    "start" {
        Start-McpServers
    }
    "stop" {
        Stop-McpServers
    }
    "status" {
        Show-McpStatus
    }
    "restart" {
        Restart-McpServers
    }
    default {
        Write-ColorOutput "❌ Invalid action. Use: start, stop, status, or restart" "Red"
        exit 1
    }
}

Write-ColorOutput "`n✨ Operation completed" "Green"
