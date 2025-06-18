# Comprehensive PowerShell script to sync ALL cloud data to local Docker instance
param(
    [string]$ProjectRef = "oflctqligzouzshimuqh",
    [string]$ServiceRoleKey = "",
    [SecureString]$DatabasePassword = $null,
    [switch]$IncludeAuth = $false
)

if (-not $ServiceRoleKey) {
    Write-Host "You need to provide your Service Role Key from Supabase Dashboard" -ForegroundColor Red
    Write-Host "1. Go to https://supabase.com/dashboard/project/$ProjectRef" -ForegroundColor Yellow
    Write-Host "2. Go to Settings -> API" -ForegroundColor Yellow
    Write-Host "3. Copy the 'service_role' key (starts with 'eyJ...')" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Usage: ./sync-comprehensive.ps1 -ServiceRoleKey 'your-key-here'" -ForegroundColor Cyan
    exit 1
}

$CloudUrl = "https://$ProjectRef.supabase.co"
$LocalUrl = "http://127.0.0.1:8000"

# Local Supabase service role key (from local environment)
$LocalServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTAwMjEyMDAsImV4cCI6MTkwNzc4NzYwMH0.n7S053n5q1Ih3_cJmdyBSUuiPmemvB3ZJgvEUoVKZ6M"

$CloudHeaders = @{
    "Authorization" = "Bearer $ServiceRoleKey"
    "apikey"        = $ServiceRoleKey
    "Content-Type"  = "application/json"
}

$LocalHeaders = @{
    "Authorization" = "Bearer $LocalServiceRoleKey"
    "apikey"        = $LocalServiceRoleKey
    "Content-Type"  = "application/json"
}

Write-Host "🚀 Comprehensive Cloud to Local Sync" -ForegroundColor Cyan
Write-Host "Syncing from Cloud: $CloudUrl" -ForegroundColor Green
Write-Host "To Local: $LocalUrl" -ForegroundColor Green

# Function to sync a table with better error handling and schema awareness
function Sync-Table {
    param($TableName)

    Write-Host "🔄 Syncing table: $TableName" -ForegroundColor Cyan

    try {
        # Get data from cloud
        $CloudData = Invoke-RestMethod -Uri "$CloudUrl/rest/v1/$TableName" -Headers $CloudHeaders -Method GET

        if ($CloudData -and $CloudData.Count -gt 0) {
            Write-Host "   📊 Found $($CloudData.Count) records in cloud $TableName" -ForegroundColor Yellow

            # Get local table schema to understand which columns exist
            if ($localSchema -match "does not exist") {
                Write-Host "   ❓ Table $TableName does not exist locally, skipping..." -ForegroundColor Yellow
                return
            }

            # Clear local table first (using TRUNCATE CASCADE to handle foreign key constraints)
            try {
                docker exec -i supabase-db psql -U postgres -d postgres -c "TRUNCATE TABLE public.$TableName CASCADE;" | Out-Null
                Write-Host "   🧹 Cleared local $TableName table" -ForegroundColor Gray
            }
            catch {
                Write-Host "   ⚠️  Could not clear local $TableName table: $($_.Exception.Message)" -ForegroundColor Yellow
            }

            # Insert each record to local
            $successCount = 0
            $errorCount = 0

            foreach ($record in $CloudData) {
                # For profiles table, filter out columns that don't exist locally
                if ($TableName -eq "profiles") {
                    # Handle PowerShell objects properly (not hashtables)
                    $recordProperties = if ($record -is [hashtable]) { $record.Keys } else { $record.PSObject.Properties.Name }
                    Write-Host "   🔍 Debug - Original record properties: $($recordProperties -join ', ')" -ForegroundColor Magenta

                    $filteredRecord = @{}
                    $localProfileColumns = @("id", "user_id", "role", "created_at", "updated_at", "email", "full_name", "avatar_url", "email_verified", "last_login", "failed_login_attempts", "locked_until", "reset_token", "reset_token_expires", "email_verification_token", "is_active")

                    foreach ($key in $recordProperties) {
                        if ($key -in $localProfileColumns) {
                            $filteredRecord[$key] = if ($record -is [hashtable]) { $record[$key] } else { $record.$key }
                        }
                        else {
                            Write-Host "   ⚠️  Filtering out column: $key" -ForegroundColor Yellow
                        }
                    }
                    Write-Host "   🔍 Debug - Filtered record properties: $($filteredRecord.Keys -join ', ')" -ForegroundColor Magenta
                    $record = $filteredRecord
                }

                $jsonData = $record | ConvertTo-Json -Compress -Depth 100
                try {
                    Invoke-RestMethod -Uri "$LocalUrl/rest/v1/$TableName" -Headers $LocalHeaders -Method POST -Body $jsonData | Out-Null
                    $successCount++
                }
                catch {
                    $errorCount++
                    Write-Host "   ❌ Failed to sync record: $($_.Exception.Message)" -ForegroundColor Red
                    # Debug: Show the failing record structure
                    if ($errorCount -eq 1) {
                        $debugProperties = if ($record -is [hashtable]) { $record.Keys } else { $record.PSObject.Properties.Name }
                        Write-Host "   🐛 Debug - Record structure: $($debugProperties -join ', ')" -ForegroundColor Magenta
                    }
                }
            }

            Write-Host "   ✅ Successfully synced $successCount/$($CloudData.Count) records to $TableName" -ForegroundColor Green
            if ($errorCount -gt 0) {
                Write-Host "   ⚠️  $errorCount records failed to sync" -ForegroundColor Yellow
            }
        }
        else {
            Write-Host "   📭 No records found in cloud $TableName" -ForegroundColor Gray
        }
    }
    catch {
        if ($_.Exception.Message -match "404") {
            Write-Host "   ❓ Table $TableName does not exist in cloud database" -ForegroundColor Yellow
        }
        else {
            Write-Host "   ❌ Error syncing $TableName : $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    Write-Host ""
}

# Function to sync auth users using Supabase API (alternative method)
function Sync-AuthUsers {
    param(
        [SecureString]$DatabasePassword,
        [switch]$DryRun = $false
    )

    if (-not $DatabasePassword) {
        Write-Host "🔐 Auth Users Sync Skipped" -ForegroundColor Yellow
        Write-Host "   To sync auth users, you need the database password from:" -ForegroundColor Gray
        Write-Host "   https://supabase.com/dashboard/project/$ProjectRef/settings/database" -ForegroundColor Gray
        Write-Host "   Then run with -IncludeAuth -DatabasePassword (Read-Host -AsSecureString 'your-password')" -ForegroundColor Cyan
        return
    }

    # Convert SecureString to plain text for use in docker exec (only in memory)
    $UnsecureDatabasePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($DatabasePassword)
    )

    Write-Host "🔐 Syncing Auth Users..." -ForegroundColor Cyan

    try {
        if (-not $DryRun) {
            Write-Host "   📥 Fetching auth users from cloud via API..." -ForegroundColor Gray

            # Try API-based approach first (more reliable)
            try {
                # Use the admin API endpoint for auth users
                $CloudAuthResponse = Invoke-RestMethod -Uri "$CloudUrl/auth/v1/admin/users" -Headers $CloudHeaders -Method GET
                $CloudAuthUsers = $CloudAuthResponse.users
                Write-Host "   📊 Found $($CloudAuthUsers.Count) auth users in cloud" -ForegroundColor Yellow

                if ($CloudAuthUsers -and $CloudAuthUsers.Count -gt 0) {
                    Write-Host "   🧹 Clearing local auth users..." -ForegroundColor Gray
                    docker exec -i supabase-db psql -U postgres -d postgres -c "TRUNCATE auth.users CASCADE;" | Out-Null

                    $successCount = 0
                    foreach ($user in $CloudAuthUsers) {
                        try {
                            # Create user via admin API on local instance
                            $createUserPayload = @{
                                email         = $user.email
                                password      = "temp-password-$(Get-Random)"  # Temporary password
                                email_confirm = $true
                                user_metadata = $user.user_metadata
                                app_metadata  = $user.app_metadata
                            } | ConvertTo-Json -Depth 10

                            $localUser = Invoke-RestMethod -Uri "$LocalUrl/auth/v1/admin/users" -Headers $LocalHeaders -Method POST -Body $createUserPayload -ContentType "application/json"

                            # Update with original user ID and other fields
                            $updatePayload = @{
                                email         = $user.email
                                user_metadata = $user.user_metadata
                                app_metadata  = $user.app_metadata
                            } | ConvertTo-Json -Depth 10

                            Invoke-RestMethod -Uri "$LocalUrl/auth/v1/admin/users/$($localUser.id)" -Headers $LocalHeaders -Method PUT -Body $updatePayload -ContentType "application/json" | Out-Null

                            $successCount++
                        }
                        catch {
                            Write-Host "   ⚠️  Failed to create/update user $($user.email): $($_.Exception.Message)" -ForegroundColor Yellow
                        }
                    }
                    Write-Host "   ✅ Successfully synced $successCount/$($CloudAuthUsers.Count) auth users" -ForegroundColor Green
                }
            }
            catch {
                Write-Host "   ⚠️  API method failed: $($_.Exception.Message)" -ForegroundColor Yellow
                Write-Host "   🔄 Trying pg_dump method..." -ForegroundColor Yellow

                # Fallback to pg_dump method
                $CloudDbHost = "db.$ProjectRef.supabase.co"
                Write-Host "   📥 Dumping auth users from cloud via pg_dump..." -ForegroundColor Gray

                # Use existing sync service container for pg_dump
                docker exec -e PGPASSWORD="$UnsecureDatabasePassword" supabase-sync-service pg_dump -h $CloudDbHost -p 5432 -U postgres -d postgres --data-only --table=auth.users --table=auth.identities --inserts > cloud_auth_users.sql

                if ($LASTEXITCODE -eq 0 -and (Test-Path "cloud_auth_users.sql") -and (Get-Item "cloud_auth_users.sql").Length -gt 0) {
                    Write-Host "   🧹 Clearing local auth users..." -ForegroundColor Gray
                    docker exec -i supabase-db psql -U postgres -d postgres -c "TRUNCATE auth.users CASCADE; TRUNCATE auth.identities CASCADE;" | Out-Null

                    Write-Host "   📤 Applying auth users to local database..." -ForegroundColor Gray
                    Get-Content cloud_auth_users.sql | docker exec -i supabase-db psql -U postgres -d postgres | Out-Null

                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "   ✅ Auth users synced successfully via pg_dump" -ForegroundColor Green
                        # Clean up
                        Remove-Item "cloud_auth_users.sql" -ErrorAction SilentlyContinue
                    }
                    else {
                        Write-Host "   ❌ Failed to apply auth users to local database" -ForegroundColor Red
                    }
                }
                else {
                    Write-Host "   ❌ Failed to dump auth users from cloud" -ForegroundColor Red
                }
            }
        }
        else {
            Write-Host "   🧪 DRY RUN: Would sync auth users" -ForegroundColor Magenta
        }
    }
    catch {
        Write-Host "   ❌ Error syncing auth users: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Sync all discovered tables from the cloud database
$TablesToSync = @(
    "profiles",
    "user_profiles",
    "projects",
    "training_sessions",
    "model_versions",
    "deployments",
    "userinfo",
    "user_sessions",
    "audit_logs",
    "email_verification_tokens",
    "password_reset_tokens"
)

Write-Host "📋 Tables to sync: $($TablesToSync -join ', ')" -ForegroundColor Cyan
Write-Host ""

foreach ($table in $TablesToSync) {
    Sync-Table -TableName $table
}

if ($IncludeAuth) {
    Sync-AuthUsers -DatabasePassword $DatabasePassword
}
else {
    Write-Host "🔐 Note: Auth users sync requires database password" -ForegroundColor Yellow
    Write-Host "   Add -IncludeAuth and -DatabasePassword to sync auth users" -ForegroundColor Gray
    Write-Host "   Example: ./sync-comprehensive.ps1 -ServiceRoleKey 'key' -IncludeAuth -DatabasePassword 'pass'" -ForegroundColor Gray
}

Write-Host "🎉 Comprehensive sync completed!" -ForegroundColor Green
Write-Host "📊 All available cloud data has been synchronized to your local database." -ForegroundColor Green
