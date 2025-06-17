# Supabase Analytics Password Authentication Fix Script
# Fixes the common issue where supabase-analytics fails with password authentication errors
#
# ISSUE DESCRIPTION:
# The supabase-analytics service fails to start with errors like:
# "FATAL 28P01 (invalid_password) password authentication failed for user 'supabase_admin'"
#
# ROOT CAUSE:
# The supabase_admin user password is not being set during database initialization
# because the roles.sql file is missing the password configuration for supabase_admin.
#
# SOLUTION:
# This script adds the missing password configuration and resets the environment.
#
# Features:
#   • Diagnoses the supabase_admin password issue
#   • Fixes the roles.sql configuration file
#   • Performs complete environment reset
#   • Verifies the fix by testing connections
#   • Provides detailed logging and reporting
#
# Usage Examples:
#   .\scripts\21-fix-supabase-analytics.ps1                # Interactive fix
#   .\scripts\21-fix-supabase-analytics.ps1 -Force        # Force fix without prompts
#   .\scripts\21-fix-supabase-analytics.ps1 -DiagnoseOnly # Diagnose only, no fixes
#   .\scripts\21-fix-supabase-analytics.ps1 -Verbose      # Verbose output

param(
    [switch]$Force,
    [switch]$DiagnoseOnly,
    [switch]$Verbose
)

# Configuration
$LogFile = "logs\supabase-analytics-fix-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$RolesFile = "docker\volumes\db\roles.sql"
$EnvFile = "docker\.env"

# Ensure logs directory exists
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" -Force | Out-Null
}

# Function to log messages
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Write to console with colors
    switch ($Level.ToUpper()) {
        "ERROR" { Write-Host $logEntry -ForegroundColor Red }
        "WARNING" { Write-Host $logEntry -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $logEntry -ForegroundColor Green }
        "INFO" { Write-Host $logEntry -ForegroundColor Cyan }
        "DEBUG" { if ($Verbose) { Write-Host $logEntry -ForegroundColor Gray } }
        default { Write-Host $logEntry }
    }
    
    # Write to log file
    Add-Content -Path $LogFile -Value $logEntry -ErrorAction SilentlyContinue
}

# Function to diagnose the issue
function Test-SupabaseAnalyticsIssue {
    Write-Log "🔍 DIAGNOSING SUPABASE ANALYTICS ISSUE..." "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"
    
    $issuesFound = @()
    
    # Check if Docker is running
    try {
        docker version | Out-Null
        Write-Log "✅ Docker is running" "SUCCESS"
    }
    catch {
        Write-Log "❌ Docker is not running or not accessible" "ERROR"
        $issuesFound += "Docker not running"
        return $issuesFound
    }
    
    # Check if containers are running
    try {
        $containers = docker ps --format "{{.Names}}" 2>$null
        $analyticsRunning = $containers -contains "supabase-analytics"
        $dbRunning = $containers -contains "supabase-db"
        
        if ($analyticsRunning -and $dbRunning) {
            Write-Log "✅ Supabase containers are running" "SUCCESS"
            
            # Check analytics logs for password errors
            $analyticsLogs = docker logs supabase-analytics --tail 50 2>$null
            if ($analyticsLogs -match "password authentication failed for user.*supabase_admin") {
                Write-Log "❌ Found password authentication errors in analytics logs" "ERROR"
                $issuesFound += "Password authentication failed"
            } else {
                Write-Log "✅ No password authentication errors found" "SUCCESS"
            }
        } else {
            Write-Log "⚠️  Supabase containers not running" "WARNING"
            $issuesFound += "Containers not running"
        }
    }
    catch {
        Write-Log "⚠️  Could not check container status" "WARNING"
        $issuesFound += "Cannot check containers"
    }
    
    # Check roles.sql file
    if (Test-Path $RolesFile) {
        $rolesContent = Get-Content $RolesFile -Raw
        if ($rolesContent -match "ALTER USER supabase_admin WITH PASSWORD") {
            Write-Log "✅ roles.sql contains supabase_admin password configuration" "SUCCESS"
        } else {
            Write-Log "❌ roles.sql is missing supabase_admin password configuration" "ERROR"
            $issuesFound += "Missing supabase_admin password config"
        }
    } else {
        Write-Log "❌ roles.sql file not found" "ERROR"
        $issuesFound += "roles.sql not found"
    }
    
    # Check environment file
    if (Test-Path $EnvFile) {
        Write-Log "✅ Environment file exists" "SUCCESS"
    } else {
        Write-Log "❌ Environment file (.env) not found" "ERROR"
        $issuesFound += ".env file not found"
    }
    
    return $issuesFound
}

# Function to fix the roles.sql file
function Repair-RolesConfiguration {
    Write-Log "🔧 FIXING ROLES CONFIGURATION..." "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"
    
    if (-not (Test-Path $RolesFile)) {
        Write-Log "❌ roles.sql file not found at: $RolesFile" "ERROR"
        return $false
    }
    
    # Create backup
    $backupFile = "$RolesFile.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $RolesFile $backupFile -Force
    Write-Log "📁 Created backup: $backupFile" "SUCCESS"
    
    # Read current content
    $content = Get-Content $RolesFile -Raw
    
    # Check if already fixed
    if ($content -match "ALTER USER supabase_admin WITH PASSWORD") {
        Write-Log "✅ roles.sql already contains supabase_admin configuration" "SUCCESS"
        return $true
    }
    
    # Add the missing line
    $lines = Get-Content $RolesFile
    $newLines = @()
    
    foreach ($line in $lines) {
        $newLines += $line
        # Add supabase_admin after supabase_storage_admin
        if ($line -match "ALTER USER supabase_storage_admin WITH PASSWORD") {
            $newLines += "ALTER USER supabase_admin WITH PASSWORD :'pgpass';"
        }
    }
    
    # Write the fixed content
    $newLines | Set-Content $RolesFile -Encoding UTF8
    
    Write-Log "✅ Added supabase_admin password configuration to roles.sql" "SUCCESS"
    Write-Log "📝 Added line: ALTER USER supabase_admin WITH PASSWORD :'pgpass';" "DEBUG"
    
    return $true
}

# Function to reset Supabase environment
function Reset-SupabaseEnvironment {
    Write-Log "🔄 RESETTING SUPABASE ENVIRONMENT..." "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"
    
    # Change to docker directory
    Push-Location "docker"
    
    try {
        # Stop all services
        Write-Log "🛑 Stopping Supabase services..." "INFO"
        docker compose down 2>$null
        
        # Remove volumes to force fresh initialization
        Write-Log "🗑️  Removing volumes for fresh start..." "INFO"
        docker compose down -v --remove-orphans 2>$null
        
        # Clean up persistent data
        Write-Log "🧹 Cleaning up persistent database data..." "INFO"
        if (Test-Path "volumes\db\data") {
            Remove-Item -Path "volumes\db\data" -Recurse -Force -ErrorAction SilentlyContinue
            Write-Log "✅ Removed persistent database data" "SUCCESS"
        }
        
        # Start services
        Write-Log "🚀 Starting Supabase services..." "INFO"
        docker compose up -d
        
        # Wait for services to be healthy
        Write-Log "⏳ Waiting for services to become healthy..." "INFO"
        $maxAttempts = 30
        $attempt = 0
        
        do {
            Start-Sleep 10
            $attempt++
            
            $healthyContainers = docker ps --filter "health=healthy" --format "{{.Names}}" 2>$null
            $totalContainers = docker ps --format "{{.Names}}" 2>$null
            
            Write-Log "📊 Healthy containers: $($healthyContainers.Count)/$($totalContainers.Count)" "DEBUG"
            
            if ($healthyContainers -contains "supabase-analytics" -and $healthyContainers -contains "supabase-db") {
                Write-Log "✅ Key services are healthy" "SUCCESS"
                break
            }
            
        } while ($attempt -lt $maxAttempts)
        
        if ($attempt -ge $maxAttempts) {
            Write-Log "⚠️  Services took longer than expected to become healthy" "WARNING"
        }
    }
    finally {
        Pop-Location
    }
}

# Function to verify the fix
function Test-SupabaseFix {
    Write-Log "🧪 VERIFYING THE FIX..." "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"
    
    $allTestsPassed = $true
    
    # Test 1: Check analytics logs
    try {
        $analyticsLogs = docker logs supabase-analytics --tail 20 2>$null
        if ($analyticsLogs -match "password authentication failed") {
            Write-Log "❌ Still finding password authentication errors" "ERROR"
            $allTestsPassed = $false
        } else {
            Write-Log "✅ No password authentication errors in analytics logs" "SUCCESS"
        }
    }
    catch {
        Write-Log "⚠️  Could not check analytics logs" "WARNING"
    }
    
    # Test 2: Test supabase_admin connection
    try {
        $connectionTest = docker exec supabase-db psql -U supabase_admin -d _supabase -c "SELECT 'Connection successful' as status;" 2>$null
        if ($connectionTest -match "Connection successful") {
            Write-Log "✅ supabase_admin database connection working" "SUCCESS"
        } else {
            Write-Log "❌ supabase_admin database connection failed" "ERROR"
            $allTestsPassed = $false
        }
    }
    catch {
        Write-Log "❌ Could not test supabase_admin connection" "ERROR"
        $allTestsPassed = $false
    }
    
    # Test 3: Check container health
    try {
        $healthyContainers = docker ps --filter "health=healthy" --format "{{.Names}}" 2>$null
        if ($healthyContainers -contains "supabase-analytics") {
            Write-Log "✅ Analytics service is healthy" "SUCCESS"
        } else {
            Write-Log "❌ Analytics service is not healthy" "ERROR"
            $allTestsPassed = $false
        }
    }
    catch {
        Write-Log "⚠️  Could not check container health" "WARNING"
    }
    
    return $allTestsPassed
}

# Main execution
function Main {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
    Write-Host "║                    SUPABASE ANALYTICS PASSWORD FIX SCRIPT                     ║" -ForegroundColor Blue  
    Write-Host "║                                                                                ║" -ForegroundColor Blue
    Write-Host "║  This script fixes the common password authentication issue with               ║" -ForegroundColor Blue
    Write-Host "║  supabase-analytics service failing to connect to the database.               ║" -ForegroundColor Blue
    Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
    Write-Host ""
    
    Write-Log "🏁 Starting Supabase Analytics Fix Script" "INFO"
    Write-Log "📄 Log file: $LogFile" "INFO"
    
    # Step 1: Diagnose the issue
    $issues = Test-SupabaseAnalyticsIssue
    
    if ($issues.Count -eq 0) {
        Write-Log "🎉 No issues found! Supabase Analytics appears to be working correctly." "SUCCESS"
        return
    }
    
    Write-Log "📋 Issues found:" "WARNING"
    foreach ($issue in $issues) {
        Write-Log "   • $issue" "WARNING"
    }
    
    if ($DiagnoseOnly) {
        Write-Log "🔍 Diagnosis complete. Exiting (DiagnoseOnly mode)." "INFO"
        return
    }
    
    # Step 2: Confirm action
    if (-not $Force) {
        Write-Host ""
        $confirmation = Read-Host "Do you want to proceed with the fix? This will modify roles.sql and reset Supabase (y/N)"
        if ($confirmation -notmatch '^[Yy]') {
            Write-Log "❌ Fix cancelled by user" "INFO"
            return
        }
    }
    
    # Step 3: Fix the configuration
    if (-not (Repair-RolesConfiguration)) {
        Write-Log "❌ Failed to fix roles configuration" "ERROR"
        return
    }
    
    # Step 4: Reset environment
    Reset-SupabaseEnvironment
    
    # Step 5: Verify the fix
    Start-Sleep 5
    $fixSuccessful = Test-SupabaseFix
    
    # Step 6: Report results
    Write-Host ""
    if ($fixSuccessful) {
        Write-Log "🎉 SUCCESS! Supabase Analytics issue has been resolved." "SUCCESS"
        Write-Log "✅ You can now access:" "SUCCESS"
        Write-Log "   • Supabase Studio: http://localhost:54323" "SUCCESS"
        Write-Log "   • API Gateway: http://localhost:8000" "SUCCESS"
        Write-Log "   • Analytics: http://localhost:4000" "SUCCESS"
    } else {
        Write-Log "❌ The fix may not have been completely successful." "ERROR"
        Write-Log "📋 Please check the logs and consider running the script again." "ERROR"
        Write-Log "📄 Log file: $LogFile" "ERROR"
    }
    
    Write-Log "🏁 Script completed" "INFO"
}

# Run the main function
Main
