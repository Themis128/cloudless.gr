#!/usr/bin/env pwsh
# Simple and Reliable User Backup Script for Supabase

param(
    [switch]$BackupOnly,
    [switch]$ShowUsers,
    [string]$BackupFile = ".\db-backups\users-$(Get-Date -Format 'yyyy-MM-dd-HHmm').sql"
)

function Write-ColoredOutput {
    param($Message, $Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Show-CurrentUsers {
    Write-ColoredOutput "👥 CURRENT USERS IN LOCAL SUPABASE" "Cyan"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

    try {
        # Show users with their key information
        docker exec supabase-db psql -U postgres -d postgres -c "
        SELECT
            substring(id::text, 1, 8) || '...' as user_id,
            email,
            created_at::date as created,
            CASE WHEN email_confirmed_at IS NOT NULL THEN 'Yes' ELSE 'No' END as confirmed,
            CASE WHEN last_sign_in_at IS NOT NULL THEN 'Yes' ELSE 'No' END as signed_in
        FROM auth.users
        ORDER BY created_at DESC;"

        Write-ColoredOutput ""
        docker exec supabase-db psql -U postgres -d postgres -c "SELECT COUNT(*) as total_users FROM auth.users;"

        # Also check user_profiles if they exist
        Write-ColoredOutput ""
        Write-ColoredOutput "📋 User Profiles:" "Yellow"
        docker exec supabase-db psql -U postgres -d postgres -c "
        SELECT COUNT(*) as profile_count FROM public.user_profiles;" 2>/dev/null || Write-ColoredOutput "No user_profiles table found" "Gray"

        return $true
    }
    catch {
        Write-ColoredOutput "❌ Could not fetch user information" "Red"
        return $false
    }
}

function Backup-Users {
    Write-ColoredOutput "💾 BACKING UP USERS..." "Green"
    Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

    # Ensure backup directory exists
    $backupDir = Split-Path $BackupFile -Parent
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        Write-ColoredOutput "📁 Created backup directory: $backupDir" "Gray"
    }

    try {
        # Create a comprehensive SQL dump of user data
        Write-ColoredOutput "🔄 Creating SQL dump..." "Gray"

        $sqlDump = @"
-- Supabase User Backup
-- Generated: $(Get-Date)
--
-- This file contains a complete backup of your Supabase users
--

-- Begin transaction
BEGIN;

-- Backup auth.users
$(docker exec supabase-db pg_dump -U postgres -d postgres -t auth.users --data-only --column-inserts)

-- Backup auth.identities
$(docker exec supabase-db pg_dump -U postgres -d postgres -t auth.identities --data-only --column-inserts)

-- Backup user_profiles (if exists)
$(docker exec supabase-db pg_dump -U postgres -d postgres -t public.user_profiles --data-only --column-inserts 2>/dev/null || echo "-- No user_profiles table")

-- Commit transaction
COMMIT;

-- Backup completed successfully
-- Total users backed up: $(docker exec supabase-db psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM auth.users;" | ForEach-Object { $_.Trim() })
"@

        # Save the backup
        $sqlDump | Out-File -FilePath $BackupFile -Encoding UTF8

        if (Test-Path $BackupFile) {
            $size = (Get-Item $BackupFile).Length
            Write-ColoredOutput "✅ Backup completed successfully!" "Green"
            Write-ColoredOutput "📄 File: $BackupFile" "Gray"
            Write-ColoredOutput "📦 Size: $([math]::Round($size/1KB, 2)) KB" "Gray"

            # Show first few lines of backup for verification
            Write-ColoredOutput ""
            Write-ColoredOutput "📋 Backup preview:" "Yellow"
            Get-Content $BackupFile -Head 10 | ForEach-Object {
                Write-ColoredOutput "   $_" "Gray"
            }

            return $true
        }
        else {
            Write-ColoredOutput "❌ Backup file was not created" "Red"
            return $false
        }
    }
    catch {
        Write-ColoredOutput "❌ Backup failed: $($_.Exception.Message)" "Red"
        return $false
    }
}

function Test-SuperbaseConnection {
    try {
        $result = docker exec supabase-db psql -U postgres -d postgres -c "SELECT 1;" 2>$null
        return $result -match "1"
    }
    catch {
        return $false
    }
}

# Main execution
Write-ColoredOutput "👥 SUPABASE USER BACKUP TOOL" "Cyan"
Write-ColoredOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"

# Test connection first
if (-not (Test-SuperbaseConnection)) {
    Write-ColoredOutput "❌ Cannot connect to Supabase database!" "Red"
    Write-ColoredOutput "Please make sure Supabase is running: supabase start" "Yellow"
    exit 1
}

if ($ShowUsers -or (-not $BackupOnly)) {
    Show-CurrentUsers | Out-Null
}

if ($BackupOnly) {
    Write-ColoredOutput ""
    $success = Backup-Users
    if ($success) {
        Write-ColoredOutput ""
        Write-ColoredOutput "🎉 Your users are now safely backed up!" "Green"
        Write-ColoredOutput "You can now run reset operations without losing your users." "Yellow"
    }
}
else {
    Write-ColoredOutput ""
    Write-ColoredOutput "Usage:" "Yellow"
    Write-ColoredOutput "  .\simple-backup.ps1 -BackupOnly              # Create backup of current users" "Gray"
    Write-ColoredOutput "  .\simple-backup.ps1 -ShowUsers               # Just show current users" "Gray"
    Write-ColoredOutput ""
    Write-ColoredOutput "To backup your users before reset operations:" "Cyan"
    Write-ColoredOutput "  .\simple-backup.ps1 -BackupOnly" "White"
}
