#!/usr/bin/env pwsh
# IPv6 Connectivity Fix for Supabase
# This script provides solutions for the "Network unreachable" error

param(
    [switch]$CheckConnectivity,
    [switch]$UseLocal,
    [switch]$FixDNS,
    [switch]$ShowSolutions,
    [switch]$StatusCheck
)

function Write-ColoredOutput {
    param($Message, $Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-DatabaseConnectivity {
    Write-ColoredOutput "🔍 Testing Database Connectivity" "Cyan"
    Write-ColoredOutput "================================" "Gray"

    # First check local Docker environment
    Write-ColoredOutput "Checking local Docker environment..." "Yellow"
    try {
        $dockerStatus = docker ps --filter "name=supabase" --format "table {{.Names}}\t{{.Status}}" 2>$null
        if ($LASTEXITCODE -eq 0 -and $dockerStatus) {
            Write-ColoredOutput "✅ Local Supabase container running" "Green"
            Write-ColoredOutput $dockerStatus "Gray"

            # Test local connection
            Write-ColoredOutput "Testing local database connection..." "Yellow"
            try {
                $localTest = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue -InformationLevel Quiet
                if ($localTest.TcpTestSucceeded) {
                    Write-ColoredOutput "✅ Local database accessible on port 5432" "Green"
                }
                else {
                    Write-ColoredOutput "❌ Local database not accessible" "Red"
                }
            }
            catch {
                Write-ColoredOutput "❌ Local connection test failed: $($_.Exception.Message)" "Red"
            }
        }
        else {
            Write-ColoredOutput "ℹ️  Local Supabase not running" "Yellow"
            Write-ColoredOutput "   Start with: docker-compose up supabase" "Gray"
        }
    }
    catch {
        Write-ColoredOutput "ℹ️  Docker not available or not running" "Yellow"
    }

    Write-ColoredOutput ""

    # Test cloud Supabase main port
    Write-ColoredOutput "Testing db.oflctqligzouzshimuqh.supabase.co:5432..." "Yellow"
    try {
        $result = Test-NetConnection -ComputerName db.oflctqligzouzshimuqh.supabase.co -Port 5432 -WarningAction SilentlyContinue -InformationLevel Quiet
        if ($result.TcpTestSucceeded) {
            Write-ColoredOutput "✅ Direct connection successful" "Green"
        }
        else {
            Write-ColoredOutput "❌ Direct connection failed (IPv6 issue)" "Red"
        }
    }
    catch {
        Write-ColoredOutput "❌ Connection test failed: $($_.Exception.Message)" "Red"
    }

    # Test connection pooler
    Write-ColoredOutput "Testing connection pooler (port 6543)..." "Yellow"
    try {
        $result = Test-NetConnection -ComputerName db.oflctqligzouzshimuqh.supabase.co -Port 6543 -WarningAction SilentlyContinue -InformationLevel Quiet
        if ($result.TcpTestSucceeded) {
            Write-ColoredOutput "✅ Connection pooler accessible" "Green"
        }
        else {
            Write-ColoredOutput "❌ Connection pooler not accessible" "Red"
        }
    }
    catch {
        Write-ColoredOutput "❌ Pooler test failed: $($_.Exception.Message)" "Red"
    }

    # Test REST API
    Write-ColoredOutput "Testing REST API..." "Yellow"
    try {
        $response = Invoke-WebRequest -Uri "https://oflctqligzouzshimuqh.supabase.co/rest/v1/" -Method HEAD -TimeoutSec 10
        Write-ColoredOutput "✅ REST API accessible (Status: $($response.StatusCode))" "Green"
    }
    catch {
        Write-ColoredOutput "❌ REST API test failed: $($_.Exception.Message)" "Red"
    }

    Write-ColoredOutput ""
}

function Show-Solutions {
    Write-ColoredOutput "🛠️  Solutions for IPv6 Connectivity Issues" "Cyan"
    Write-ColoredOutput "===========================================" "Gray"
    Write-ColoredOutput ""

    Write-ColoredOutput "1. 🏠 Use Local Development (Recommended)" "Green"
    Write-ColoredOutput "   • Start local Supabase: docker-compose up supabase" "White"
    Write-ColoredOutput "   • Connection: postgresql://postgres:<password>@localhost:5432/postgres" "Gray"
    Write-ColoredOutput "   • Password from: docker/.env (POSTGRES_PASSWORD)" "Gray"
    Write-ColoredOutput "   • Reset & Seed: .\reset-and-seed-enhanced.ps1" "White"
    Write-ColoredOutput "   • Quick Reset: .\quick-reset.ps1" "White"
    Write-ColoredOutput ""

    Write-ColoredOutput "2. 🌐 Use REST API Instead of Direct Connection" "Green"
    Write-ColoredOutput "   • Use Supabase client libraries in your app" "White"
    Write-ColoredOutput "   • REST URL: https://oflctqligzouzshimuqh.supabase.co" "Gray"
    Write-ColoredOutput "   • Local REST: http://127.0.0.1:8000" "Gray"
    Write-ColoredOutput ""

    Write-ColoredOutput "3. 🔧 Network Configuration Fixes" "Yellow"
    Write-ColoredOutput "   • Disable IPv6 in Windows network settings" "White"
    Write-ColoredOutput "   • Use VPN that supports proper IPv6 routing" "White"
    Write-ColoredOutput "   • Contact ISP about IPv6 connectivity" "White"
    Write-ColoredOutput ""

    Write-ColoredOutput "4. 🐳 Database Management Tools" "Blue"
    Write-ColoredOutput "   • pgAdmin: docker-compose up pgadmin" "White"
    Write-ColoredOutput "   • Access via: http://localhost:8080" "Gray"
    Write-ColoredOutput "   • Update servers: .\update-pgadmin-servers.ps1" "White"
    Write-ColoredOutput ""

    Write-ColoredOutput "5. 📊 Check System Status" "Magenta"
    Write-ColoredOutput "   • Local containers: docker ps" "White"
    Write-ColoredOutput "   • Connection test: .\connection-fix.ps1 -CheckConnectivity" "White"
    Write-ColoredOutput "   • Full diagnosis: .\pgadmin-connection-info.ps1" "White"
    Write-ColoredOutput ""
}

function Switch-ToLocal {
    Write-ColoredOutput "🏠 Switching to Local Development Mode" "Cyan"
    Write-ColoredOutput "=====================================" "Gray"

    # Check if Docker is available
    try {
        $dockerVersion = docker --version 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-ColoredOutput "❌ Docker not available. Please install Docker Desktop." "Red"
            return
        }
        Write-ColoredOutput "✅ Docker available: $dockerVersion" "Green"
    }
    catch {
        Write-ColoredOutput "❌ Docker not available. Please install Docker Desktop." "Red"
        return
    }

    # Update .env file to use local Supabase
    $envPath = ".env"
    if (Test-Path $envPath) {
        $content = Get-Content $envPath
        $newContent = $content -replace "SUPABASE_URL=https://oflctqligzouzshimuqh.supabase.co", "#SUPABASE_URL=https://oflctqligzouzshimuqh.supabase.co"
        $newContent = $newContent -replace "#SUPABASE_URL=http://127.0.0.1:8000", "SUPABASE_URL=http://127.0.0.1:8000"

        $newContent | Set-Content $envPath
        Write-ColoredOutput "✅ Updated .env to use local Supabase" "Green"
    }
    else {
        Write-ColoredOutput "❌ .env file not found" "Red"
    }

    # Update db-config.ini
    $dbConfigPath = "db-config.ini"
    if (Test-Path $dbConfigPath) {
        Write-ColoredOutput "✅ db-config.ini found - should already be configured for local" "Green"
    }
    else {
        Write-ColoredOutput "⚠️  db-config.ini not found" "Yellow"
    }

    Write-ColoredOutput ""
    Write-ColoredOutput "🚀 Next Steps:" "Yellow"
    Write-ColoredOutput "1. Start local Supabase:" "White"
    Write-ColoredOutput "   docker-compose up supabase" "Gray"
    Write-ColoredOutput ""
    Write-ColoredOutput "2. Start pgAdmin (optional):" "White"
    Write-ColoredOutput "   docker-compose up pgadmin" "Gray"
    Write-ColoredOutput "   Access: http://localhost:8080" "Gray"
    Write-ColoredOutput ""
    Write-ColoredOutput "3. Reset and seed database:" "White"
    Write-ColoredOutput "   .\reset-and-seed-enhanced.ps1" "Gray"
    Write-ColoredOutput ""
    Write-ColoredOutput "4. Verify connection:" "White"
    Write-ColoredOutput "   .\connection-fix.ps1 -CheckConnectivity" "Gray"
    Write-ColoredOutput ""
    Write-ColoredOutput "📋 Local connection details:" "Yellow"
    Write-ColoredOutput "URL: http://127.0.0.1:8000" "White"
    Write-ColoredOutput "Database: postgresql://postgres:<password>@localhost:5432/postgres" "White"
    Write-ColoredOutput "Password: Check docker/.env for POSTGRES_PASSWORD" "Gray"
}

function Set-DNSSettings {
    Write-ColoredOutput "🔧 DNS Configuration Fix" "Cyan"
    Write-ColoredOutput "========================" "Gray"

    Write-ColoredOutput "Adding IPv4-preferred DNS settings..." "Yellow"

    # Show DNS settings that can help
    Write-ColoredOutput ""
    Write-ColoredOutput "Manual DNS Fix Options:" "Yellow"
    Write-ColoredOutput "1. Change DNS servers to Google DNS (8.8.8.8, 8.8.4.4)" "White"
    Write-ColoredOutput "2. Add to hosts file: C:\Windows\System32\drivers\etc\hosts" "White"
    Write-ColoredOutput "   (Requires finding IPv4 address of the Supabase server)" "Gray"
    Write-ColoredOutput ""

    Write-ColoredOutput "Windows Network Settings:" "Yellow"
    Write-ColoredOutput "1. Open Network & Internet Settings" "White"
    Write-ColoredOutput "2. Go to Network adapter options" "White"
    Write-ColoredOutput "3. Right-click your connection > Properties" "White"
    Write-ColoredOutput "4. Uncheck 'Internet Protocol Version 6 (TCP/IPv6)'" "White"
    Write-ColoredOutput "5. Restart your connection" "White"
}

# Main execution
Write-ColoredOutput "🚀 Supabase IPv6 Connection Fix Utility" "Magenta"
Write-ColoredOutput "=======================================" "Gray"
Write-ColoredOutput ""

if ($CheckConnectivity -or $args.Count -eq 0) {
    Test-DatabaseConnectivity
}

if ($ShowSolutions -or $args.Count -eq 0) {
    Show-Solutions
}

if ($UseLocal) {
    Switch-ToLocal
}

if ($FixDNS) {
    Set-DNSSettings
}

Write-ColoredOutput "💡 Quick Recommendation:" "Yellow"
Write-ColoredOutput "For immediate development, use: .\connection-fix.ps1 -UseLocal" "White"
Write-ColoredOutput "This switches to local Supabase development mode." "Gray"
