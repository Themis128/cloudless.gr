# MCP Server Task Management ✅

## Overview
You can now start, stop, and check the status of your Supabase MCP server using VS Code tasks or npm scripts.

## Available Tasks

### 🎯 **VS Code Tasks** (Ctrl+Shift+P → "Tasks: Run Task")

1. **Start MCP Server** - Starts the MCP server using the batch script
2. **Start MCP Server (Direct)** - Starts MCP server directly with environment variables
3. **Stop MCP Server** - Stops all running MCP server processes
4. **Check MCP Server Status** - Shows comprehensive status of MCP integration
5. **Verify MCP Setup** - Runs verification tests

### 📦 **NPM Scripts**

```bash
# Start MCP server
npm run mcp:start

# Stop MCP server  
npm run mcp:stop

# Check server status
npm run mcp:status

# Test environment
npm run mcp:test-env

# Verify setup
npm run mcp:verify

# Check version
npm run mcp:help
```

## Task Features

### ✅ **Start MCP Server**
- **Command**: `start-mcp.bat`
- **Features**: 
  - Loads environment variables from `.env`
  - Uses latest `@supabase/mcp-server-supabase` package
  - Runs in read-only mode for safety
  - Background process with instance limit (only one running)
  - Connects to local Supabase (192.168.0.23:54321)

### 🛑 **Stop MCP Server**
- **Script**: `stop-mcp.ps1`
- **Features**:
  - Finds all MCP-related Node.js processes
  - Gracefully stops processes
  - Handles both direct and npx-spawned processes
  - Provides detailed feedback

### 🔍 **Status Check**
- **Script**: `mcp-status.ps1`
- **Features**:
  - Checks if MCP server is running
  - Shows process details (PID, uptime)
  - Verifies Supabase connection
  - Validates MCP configuration files
  - Checks environment setup

## Configuration Files

### 📁 **VS Code Tasks** (`.vscode/tasks.json`)
```json
{
  "tasks": [
    {
      "label": "Start MCP Server",
      "command": "start-mcp.bat",
      "isBackground": true,
      "runOptions": { "instanceLimit": 1 }
    },
    {
      "label": "Stop MCP Server", 
      "command": "pwsh",
      "args": ["-File", "stop-mcp.ps1"]
    }
    // ... more tasks
  ]
}
```

### 🔧 **MCP Configuration** (`.vscode/mcp.json`)
```json
{
  "servers": {
    "supabase-local": {
      "command": "cmd",
      "args": ["/c", "npx", "@supabase/mcp-server-supabase@latest", "--read-only"],
      "env": {
        "SUPABASE_URL": "http://192.168.0.23:54321",
        "SUPABASE_ACCESS_TOKEN": "..."
      }
    }
  }
}
```

## Usage Examples

### Start and Monitor
```bash
# Start the server
npm run mcp:start

# Check if it's running
npm run mcp:status
# Output: ✅ MCP Server: Running (1 process(es))

# Work with your AI assistant...

# Stop when done
npm run mcp:stop
```

### VS Code Integration
1. **Ctrl+Shift+P** → "Tasks: Run Task"
2. Select "Start MCP Server" 
3. Server runs in background
4. Use "Check MCP Server Status" to monitor
5. Use "Stop MCP Server" when finished

### Troubleshooting
```bash
# If server won't start, check status first
npm run mcp:status

# Verify all components
npm run mcp:verify

# Force stop if needed
npm run mcp:stop
```

## Status Output Example

```
🔧 MCP Integration Status
=========================
🔍 Checking MCP Server Process...
✅ MCP Server: Running (1 process(es))
   📊 Process ID: 49912, Uptime: 00:05:23

🔍 Checking Supabase Connection...
✅ Supabase Connection: Running (192.168.0.23:54321)

🔍 Checking MCP Configuration...
✅ MCP Configuration: Found (.vscode/mcp.json)

🔍 Checking Environment...
✅ Environment File: Found (.env)

🚀 MCP integration is ready!
   Configure your AI assistant to use: .vscode/mcp.json
```

## Benefits

- **🚀 Easy Management**: One-click start/stop from VS Code
- **🔍 Monitoring**: Real-time status checking
- **🛡️ Safety**: Read-only mode and instance limits
- **📊 Debugging**: Detailed process and connection info
- **⚡ Automation**: Background tasks with proper cleanup
- **💻 Cross-Platform**: Works on Windows with PowerShell

---

**Ready to use!** Your MCP server can now be managed efficiently through VS Code tasks and npm scripts. 🎉
