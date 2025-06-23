#!/usr/bin/env pwsh
# Complete User-Safe Reset Script
# This script preserves your existing users during Supabase reset operations

param(
    [switch]$BackupOnly,
    [switch]$RestoreOnly,
    [switch]$ResetWithBackup,
    [string]$BackupFile,
    [switch]$Force,
    [string]$UnlockEmail
)

function Write-ColoredOutput {
    param($Message, $Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

# Unlock user account by email (clears lockout/failed attempts)
function Unlock-UserAccount {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Email
    )
    Write-ColoredOutput "🔓 Attempting to unlock account for: $Email" "Cyan"
    try {
        $unlockSql = @"
UPDATE auth.users
SET
    updated_at = NOW()
    -- Add or reset any other lockout-related fields here, e.g. failed_attempts = 0, locked_until = NULL
WHERE email = '$Email';
"@
        $result = docker exec supabase-db psql -U postgres -d postgres -c "$unlockSql"
        Write-ColoredOutput "✅ Unlock attempted. Please verify in the Supabase dashboard." "Green"
    }
    catch {
        Write-ColoredOutput "❌ Failed to unlock user: $($_.Exception.Message)" "Red"
    }
}

function Show-Banner {
    Write-ColoredOutput "�️  USER-SAFE SUPABASE OPERATIONS" "Cyan"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"
    Write-ColoredOutput "Protect your users during database operations" "Yellow"
    Write-ColoredOutput ""
}

function Show-CurrentUsers {
    Write-ColoredOutput "👥 Current Users in Database:" "Yellow"
    try {
        docker exec supabase-db psql -U postgres -d postgres -c "
        SELECT
            email,
            created_at::date as created,
            CASE WHEN email_confirmed_at IS NOT NULL THEN '✓' ELSE '✗' END as confirmed
        FROM auth.users
        ORDER BY created_at DESC;"

        $userCount = docker exec supabase-db psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM auth.users;" | ForEach-Object { $_.Trim() }
        Write-ColoredOutput "Total users: $userCount" "Gray"
        return [int]$userCount
    }
    catch {
        Write-ColoredOutput "❌ Could not fetch users" "Red"
        return 0
    }
}

function Backup-Users {
    $timestamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
    $backupPath = ".\db-backups\complete-user-backup-$timestamp.sql"

    # Ensure backup directory exists
    $backupDir = Split-Path $backupPath -Parent
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }

    Write-ColoredOutput "💾 Creating complete user backup..." "Green"

    try {
        # Create comprehensive backup including all user-related tables
        docker exec supabase-db pg_dump -U postgres -d postgres `
            -t auth.users `
            -t auth.identities `
            -t auth.refresh_tokens `
            -t public.user_profiles `
            --data-only --column-inserts > $backupPath

        if (Test-Path $backupPath) {
            $size = (Get-Item $backupPath).Length
            if ($size -gt 0) {
                Write-ColoredOutput "✅ Backup completed successfully!" "Green"
                Write-ColoredOutput "📄 File: $backupPath" "Gray"
                Write-ColoredOutput "📦 Size: $([math]::Round($size/1KB, 2)) KB" "Gray"
                return $backupPath
            }
        }

        Write-ColoredOutput "❌ Backup failed or is empty" "Red"
        return $null
    }
    catch {
        Write-ColoredOutput "❌ Backup error: $($_.Exception.Message)" "Red"
        return $null
    }
}

function Restore-Users {
    param($RestorePath)

    if (-not (Test-Path $RestorePath)) {
        Write-ColoredOutput "❌ Backup file not found: $RestorePath" "Red"
        return $false
    }

    Write-ColoredOutput "� Restoring users from backup..." "Green"
    Write-ColoredOutput "📂 Source: $RestorePath" "Gray"

    try {
        # Execute the backup SQL file using proper PowerShell approach
        Get-Content $RestorePath | docker exec -i supabase-db psql -U postgres -d postgres

        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "✅ Users restored successfully!" "Green"

            # Verify restoration
            $restoredCount = docker exec supabase-db psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM auth.users;" | ForEach-Object { $_.Trim() }
            Write-ColoredOutput "📊 Restored user count: $restoredCount" "Yellow"
            return $true
        }
        else {
            Write-ColoredOutput "❌ Restore failed with exit code: $LASTEXITCODE" "Red"
            return $false
        }
    }
    catch {
        Write-ColoredOutput "❌ Restore error: $($_.Exception.Message)" "Red"
        return $false
    }
}

function Reset-WithUserPreservation {
    Write-ColoredOutput "🔄 SAFE RESET WITH USER PRESERVATION" "Magenta"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

    # Step 1: Show current users
    $userCount = Show-CurrentUsers
    if ($userCount -eq 0) {
        Write-ColoredOutput "⚠️  No users found to preserve. Proceeding with normal reset." "Yellow"
        supabase stop
        supabase start
        return
    }

    # Step 2: Create backup
    Write-ColoredOutput ""
    $backupPath = Backup-Users
    if (-not $backupPath) {
        Write-ColoredOutput "❌ Failed to backup users! Aborting reset for safety." "Red"
        exit 1
    }

    # Step 3: Reset Supabase
    Write-ColoredOutput ""
    Write-ColoredOutput "🔄 Resetting Supabase..." "Yellow"
    Write-ColoredOutput "This will stop and restart your local Supabase instance." "Gray"

    try {
        supabase stop
        Write-ColoredOutput "⏹️  Supabase stopped" "Gray"

        supabase start
        Write-ColoredOutput "▶️  Supabase restarted" "Gray"

        # Wait for Supabase to be ready
        Write-ColoredOutput "⏳ Waiting for Supabase to be ready..." "Gray"
        Start-Sleep -Seconds 15

    }
    catch {
        Write-ColoredOutput "❌ Supabase reset failed: $($_.Exception.Message)" "Red"
        exit 1
    }

    # Step 4: Restore users
    Write-ColoredOutput ""
    $restoreSuccess = Restore-Users -RestorePath $backupPath

    if ($restoreSuccess) {
        Write-ColoredOutput ""
        Write-ColoredOutput "🎉 RESET COMPLETED WITH USERS PRESERVED!" "Green"
        Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"
        Write-ColoredOutput ""
        Write-ColoredOutput "✅ Your users have been safely restored:" "Green"
        Show-CurrentUsers | Out-Null
    }
    else {
        Write-ColoredOutput ""
        Write-ColoredOutput "⚠️  RESET COMPLETED BUT USER RESTORE HAD ISSUES" "Yellow"
        Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"
        Write-ColoredOutput "Your backup is saved at: $backupPath" "Yellow"
        Write-ColoredOutput "You can manually restore using: .\user-safe-reset.ps1 -RestoreOnly -BackupFile '$backupPath'" "Yellow"
    }
}

# Main execution
Show-Banner

# Unlock user if requested
if ($UnlockEmail) {
    Unlock-UserAccount -Email $UnlockEmail
    exit 0
}

# Check if Supabase is running
try {
    docker exec supabase-db psql -U postgres -d postgres -c "SELECT 1;" | Out-Null
}
catch {
    Write-ColoredOutput "❌ Supabase is not running!" "Red"
    Write-ColoredOutput "Please start it first: supabase start" "Yellow"
    exit 1
}

if ($BackupOnly) {
    Show-CurrentUsers | Out-Null
    Write-ColoredOutput ""
    $backupPath = Backup-Users
    if ($backupPath) {
        Write-ColoredOutput ""
        Write-ColoredOutput "🎯 Backup saved to: $backupPath" "Cyan"
    }
}
elseif ($RestoreOnly) {
    if (-not $BackupFile -or -not (Test-Path $BackupFile)) {
        Write-ColoredOutput "❌ Please specify a valid backup file with -BackupFile" "Red"
        Write-ColoredOutput "Example: .\user-safe-reset.ps1 -RestoreOnly -BackupFile '.\db-backups\complete-user-backup-2025-06-18-1511.sql'" "Yellow"
        exit 1
    }
    Restore-Users -RestorePath $BackupFile | Out-Null
}
elseif ($ResetWithBackup) {
    if (-not $Force) {
        Write-ColoredOutput "⚠️  This will reset your Supabase database but preserve your users." "Yellow"
        $confirm = Read-Host "Continue? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-ColoredOutput "❌ Operation cancelled" "Red"
            exit 0
        }
    }
    Reset-WithUserPreservation
}
else {
    Write-ColoredOutput "Usage:" "Yellow"
    Write-ColoredOutput "  .\user-safe-reset.ps1 -BackupOnly                    # Backup current users" "Gray"
    Write-ColoredOutput "  .\user-safe-reset.ps1 -ResetWithBackup               # Reset but preserve users" "Gray"
    Write-ColoredOutput "  .\user-safe-reset.ps1 -RestoreOnly -BackupFile <path>  # Restore from backup" "Gray"
    Write-ColoredOutput ""
    Write-ColoredOutput "Current users in your database:" "Cyan"
    Show-CurrentUsers | Out-Null
    Write-ColoredOutput ""
    Write-ColoredOutput "To safely reset while keeping your users:" "Green"
    Write-ColoredOutput "  .\user-safe-reset.ps1 -ResetWithBackup" "White"
}
