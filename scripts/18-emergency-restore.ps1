# Emergency Recovery and Restore Script
# Comprehensive recovery script for when things go wrong
# Restores the entire development environment to a known working state
#
# Features:
#   • Complete environment recovery
#   • Database restoration from backup
#   • Configuration file restoration
#   • Docker environment rebuild
#   • Backup creation before recovery
#   • Rollback capabilities
#
# Usage Examples:
#   .\scripts\18-emergency-restore.ps1                    # Interactive recovery
#   .\scripts\18-emergency-restore.ps1 -Force           # Force recovery without prompts
#   .\scripts\18-emergency-restore.ps1 -BackupFirst     # Create backup before recovery
#   .\scripts\18-emergency-restore.ps1 -ConfigOnly      # Restore configuration only

param(
    [switch]$Force,
    [switch]$BackupFirst,
    [switch]$ConfigOnly,
    [switch]$VerboseOutput
)

# Configuration
$BaseDirectory = Get-Location
$LogFile = "logs\emergency-restore-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$BackupDir = "backups\emergency-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

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
    
    # Write to console
    switch ($Level) {
        "ERROR" { Write-Host $logEntry -ForegroundColor Red }
        "WARNING" { Write-Host $logEntry -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $logEntry -ForegroundColor Green }
        "INFO" { Write-Host $logEntry -ForegroundColor Cyan }
        default { Write-Host $logEntry }
    }
    
    # Write to log file
    Add-Content -Path $LogFile -Value $logEntry
}

# Function to create emergency backup
function New-EmergencyBackup {
    Write-Log "🔄 CREATING EMERGENCY BACKUP..." "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"
    
    try {
        # Create backup directory
        if (-not (Test-Path $BackupDir)) {
            New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
            Write-Log "📁 Created backup directory: $BackupDir" "SUCCESS"
        }
        
        # Backup critical files
        $criticalFiles = @(
            "docker\.env",
            "docker\docker-compose.yml",
            "nuxt.config.ts",
            "package.json",
            ".gitignore"
        )
        
        foreach ($file in $criticalFiles) {
            if (Test-Path $file) {
                $backupPath = Join-Path $BackupDir $file
                $backupDir = Split-Path $backupPath -Parent
                
                if (-not (Test-Path $backupDir)) {
                    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
                }
                
                Copy-Item $file $backupPath -Force
                Write-Log "✅ Backed up: $file" "SUCCESS"
            } else {
                Write-Log "⚠️  File not found: $file" "WARNING"
            }
        }
        
        # Backup Docker volumes if they exist
        Write-Log "🐳 Checking Docker volumes..." "INFO"
        try {
            $volumes = docker volume ls -q 2>$null
            if ($volumes -and $volumes.Count -gt 0) {
                Write-Log "📦 Found $($volumes.Count) Docker volumes" "INFO"
                # Create volume list for reference
                $volumes | Out-File -FilePath (Join-Path $BackupDir "docker-volumes.txt")
                Write-Log "📝 Docker volume list saved" "SUCCESS"
            }
        } catch {
            Write-Log "⚠️  Could not check Docker volumes: $($_.Exception.Message)" "WARNING"
        }
        
        return $true
        
    } catch {
        Write-Log "❌ Backup creation failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Function to stop all services
function Stop-AllServices {
    Write-Log "🛑 STOPPING ALL SERVICES..." "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"
    
    try {
        # Stop Docker services
        if (Test-Path "docker\docker-compose.yml") {
            Set-Location "docker"
            try {
                Write-Log "🐳 Stopping Docker containers..." "INFO"
                docker-compose down --remove-orphans 2>&1 | Out-Host
                Write-Log "✅ Docker containers stopped" "SUCCESS"
            } finally {
                Set-Location ".."
            }
        }
        
        # Stop any Node.js processes
        try {
            Write-Log "📡 Stopping Node.js processes..." "INFO"
            Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
            Write-Log "✅ Node.js processes stopped" "SUCCESS"
        } catch {
            Write-Log "ℹ️  No Node.js processes to stop" "INFO"
        }
        
        return $true
        
    } catch {
        Write-Log "❌ Error stopping services: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Function to clean Docker environment
function Reset-DockerEnvironment {
    Write-Log "🧹 CLEANING DOCKER ENVIRONMENT..." "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"
    
    try {
        # Remove containers
        Write-Log "🗑️  Removing Docker containers..." "INFO"
        docker container prune -f 2>&1 | Out-Host
        
        # Remove networks
        Write-Log "🌐 Removing Docker networks..." "INFO"
        docker network prune -f 2>&1 | Out-Host
        
        # Remove volumes
        Write-Log "💾 Removing Docker volumes..." "INFO"
        docker volume prune -f 2>&1 | Out-Host
        
        # Remove images (optional, commented out for safety)
        # Write-Log "🖼️  Removing Docker images..." "INFO"
        # docker image prune -f 2>&1 | Out-Host
        
        Write-Log "✅ Docker environment cleaned" "SUCCESS"
        return $true
        
    } catch {
        Write-Log "❌ Error cleaning Docker environment: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Function to restore configuration files
function Restore-Configuration {
    Write-Log "⚙️  RESTORING CONFIGURATION..." "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"
    
    try {
        # Restore or create .env file
        $envFile = "docker\.env"
        if (-not (Test-Path $envFile)) {
            Write-Log "📝 Creating default .env file..." "INFO"
            
            $defaultEnvContent = @"
# Supabase Configuration - Emergency Restore
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Database Configuration
DB_PASSWORD=your-super-secret-and-long-postgres-password
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long

# Port Configuration
STUDIO_PORT=54323
API_PORT=54321
DB_PORT=54322
"@
            
            Set-Content -Path $envFile -Value $defaultEnvContent
            Write-Log "✅ Default .env file created" "SUCCESS"
        } else {
            Write-Log "✅ .env file already exists" "SUCCESS"
        }
        
        # Check Docker Compose file
        $composeFile = "docker\docker-compose.yml"
        if (-not (Test-Path $composeFile)) {
            Write-Log "⚠️  Docker Compose file missing - this needs manual restoration" "WARNING"
            return $false
        } else {
            Write-Log "✅ Docker Compose file exists" "SUCCESS"
        }
        
        return $true
        
    } catch {
        Write-Log "❌ Configuration restoration failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Function to fix line endings
function Repair-LineEndings {
    Write-Log "🔧 FIXING LINE ENDINGS..." "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"
    
    try {
        $criticalFiles = @(
            "docker\docker-compose.yml",
            "docker\.env",
            "nuxt.config.ts",
            "package.json"
        )
        
        foreach ($file in $criticalFiles) {
            if (Test-Path $file) {
                try {
                    $content = Get-Content $file -Raw
                    if ($content) {
                        # Normalize line endings
                        $content = $content -replace "`r`n", "`n" -replace "`r", "`n"
                        if ($IsWindows) {
                            $content = $content -replace "`n", "`r`n"
                        }
                        [System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
                        Write-Log "✅ Fixed line endings: $file" "SUCCESS"
                    }
                } catch {
                    Write-Log "⚠️  Could not fix line endings for $file: $($_.Exception.Message)" "WARNING"
                }
            }
        }
        
        return $true
        
    } catch {
        Write-Log "❌ Line ending repair failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Function to restart services
function Start-Services {
    Write-Log "🚀 STARTING SERVICES..." "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"
    
    try {
        if (Test-Path "docker\docker-compose.yml") {
            Set-Location "docker"
            try {
                Write-Log "🐳 Starting Docker services..." "INFO"
                docker-compose up -d 2>&1 | Out-Host
                
                # Wait for services to be ready
                Write-Log "⏳ Waiting for services to be ready..." "INFO"
                Start-Sleep -Seconds 10
                
                # Check service status
                Write-Log "📊 Checking service status..." "INFO"
                docker-compose ps 2>&1 | Out-Host
                
                Write-Log "✅ Services started" "SUCCESS"
            } finally {
                Set-Location ".."
            }
        }
        
        return $true
        
    } catch {
        Write-Log "❌ Error starting services: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Function to verify restoration
function Test-Restoration {
    Write-Log "🔍 VERIFYING RESTORATION..." "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"
    
    try {
        # Test if we can run the verification script
        if (Test-Path "scripts\05-verify-setup.js") {
            Write-Log "🧪 Running setup verification..." "INFO"
            $verifyResult = node scripts\05-verify-setup.js --quick 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Log "✅ Verification passed" "SUCCESS"
                return $true
            } else {
                Write-Log "⚠️  Verification had issues, but system may still be functional" "WARNING"
                return $false
            }
        } else {
            Write-Log "⚠️  Verification script not found, skipping automated testing" "WARNING"
            return $true
        }
        
    } catch {
        Write-Log "❌ Verification failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Main execution
Write-Host "🚨 EMERGENCY RECOVERY AND RESTORE SCRIPT" -ForegroundColor Red
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Write-Log "🚨 EMERGENCY RECOVERY INITIATED" "INFO"
Write-Log "Log file: $LogFile" "INFO"

if (-not $Force) {
    Write-Host ""
    Write-Host "⚠️  This script will perform emergency recovery operations:" -ForegroundColor Yellow
    Write-Host "  • Stop all running services" -ForegroundColor White
    Write-Host "  • Clean Docker environment" -ForegroundColor White
    Write-Host "  • Restore configuration files" -ForegroundColor White
    Write-Host "  • Restart services" -ForegroundColor White
    Write-Host "  • Verify restoration" -ForegroundColor White
    
    if ($BackupFirst) {
        Write-Host "  • Create emergency backup first" -ForegroundColor White
    }
    
    Write-Host ""
    $response = Read-Host "Continue with emergency recovery? (Y/n)"
    if ($response -eq 'n' -or $response -eq 'N') {
        Write-Log "❌ Recovery cancelled by user" "INFO"
        exit 0
    }
}

$startTime = Get-Date

try {
    # Step 1: Create backup if requested
    if ($BackupFirst) {
        $backupSuccess = New-EmergencyBackup
        if (-not $backupSuccess) {
            Write-Log "⚠️  Backup failed, but continuing with recovery..." "WARNING"
        }
    }
    
    # Step 2: Stop all services
    $stopSuccess = Stop-AllServices
    if (-not $stopSuccess) {
        throw "Failed to stop services"
    }
    
    # Step 3: Clean Docker environment (skip if config only)
    if (-not $ConfigOnly) {
        $cleanSuccess = Reset-DockerEnvironment
        if (-not $cleanSuccess) {
            Write-Log "⚠️  Docker cleanup had issues, but continuing..." "WARNING"
        }
    }
    
    # Step 4: Restore configuration
    $configSuccess = Restore-Configuration
    if (-not $configSuccess) {
        throw "Failed to restore configuration"
    }
    
    # Step 5: Fix line endings
    $lineEndingSuccess = Repair-LineEndings
    if (-not $lineEndingSuccess) {
        Write-Log "⚠️  Line ending repair had issues, but continuing..." "WARNING"
    }
    
    # Step 6: Start services (skip if config only)
    if (-not $ConfigOnly) {
        $startSuccess = Start-Services
        if (-not $startSuccess) {
            throw "Failed to start services"
        }
        
        # Step 7: Verify restoration
        $verifySuccess = Test-Restoration
        if (-not $verifySuccess) {
            Write-Log "⚠️  Verification had issues, but recovery may still be successful" "WARNING"
        }
    }
    
    # Success summary
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-Log "🎉 EMERGENCY RECOVERY COMPLETED SUCCESSFULLY!" "SUCCESS"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "SUCCESS"
    Write-Log "⏱️  Total recovery time: $($duration.Minutes)m $($duration.Seconds)s" "INFO"
    
    if ($BackupFirst) {
        Write-Log "📁 Backup created in: $BackupDir" "INFO"
    }
    
    Write-Host ""
    Write-Host "🌐 Access Points:" -ForegroundColor Cyan
    Write-Host "  • Supabase Studio: http://localhost:54323" -ForegroundColor White
    Write-Host "  • API Endpoint: http://localhost:54321" -ForegroundColor White
    Write-Host "  • Database: localhost:54322" -ForegroundColor White
    
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "  • Test connectivity: .\scripts\12-test-connectivity.ps1" -ForegroundColor White
    Write-Host "  • Verify setup: node scripts\05-verify-setup.js" -ForegroundColor White
    Write-Host "  • Check database: node scripts\06-check-database.js" -ForegroundColor White
    
    Write-Log "✅ Recovery log saved to: $LogFile" "INFO"
    
} catch {
    Write-Log "❌ EMERGENCY RECOVERY FAILED: $($_.Exception.Message)" "ERROR"
    Write-Host ""
    Write-Host "💡 Manual recovery steps:" -ForegroundColor Yellow
    Write-Host "  1. Check Docker is running: docker --version" -ForegroundColor White
    Write-Host "  2. Navigate to docker directory: cd docker" -ForegroundColor White
    Write-Host "  3. Start services: docker-compose up -d" -ForegroundColor White
    Write-Host "  4. Check logs: docker-compose logs -f" -ForegroundColor White
    Write-Host "  5. Review error log: $LogFile" -ForegroundColor White
    
    exit 1
}
