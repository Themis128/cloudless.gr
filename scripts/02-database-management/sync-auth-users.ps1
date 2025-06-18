# PowerShell script to sync Supabase Auth users from cloud to local
param(
    [string]$ProjectRef = "oflctqligzouzshimuqh",
    [string]$DatabasePassword = "",
    [switch]$DryRun = $false
)

if (-not $DatabasePassword) {
    Write-Host "❌ You need to provide your cloud database password" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 To get your database password:" -ForegroundColor Yellow
    Write-Host "1. Go to https://supabase.com/dashboard/project/$ProjectRef" -ForegroundColor Cyan
    Write-Host "2. Go to Settings -> Database" -ForegroundColor Cyan
    Write-Host "3. Copy the password from Connection parameters" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: ./sync-auth-users.ps1 -DatabasePassword 'your-db-password'" -ForegroundColor Green
    exit 1
}

$CloudDbHost = "db.$ProjectRef.supabase.co"
$CloudDbPort = "5432"
$CloudDbName = "postgres"
$CloudDbUser = "postgres"

Write-Host "🚀 Syncing Auth Users from Cloud to Local" -ForegroundColor Cyan
Write-Host "Cloud DB: $CloudDbHost" -ForegroundColor Yellow
Write-Host "Local DB: Docker container 'supabase-db'" -ForegroundColor Yellow
Write-Host ""

if ($DryRun) {
    Write-Host "🧪 DRY RUN MODE - No actual sync will be performed" -ForegroundColor Magenta
    Write-Host ""
}

# Step 1: Dump auth users from cloud
Write-Host "📤 Step 1: Dumping auth users from cloud database..." -ForegroundColor Cyan
$dumpCommand = "pg_dump -h $CloudDbHost -p $CloudDbPort -U $CloudDbUser -d $CloudDbName --data-only --table=auth.users --table=auth.identities --inserts > cloud_auth_users.sql"

Write-Host "Command to run:" -ForegroundColor Gray
Write-Host $dumpCommand -ForegroundColor Gray
Write-Host ""

if (-not $DryRun) {
    $env:PGPASSWORD = $DatabasePassword
    try {
        pg_dump -h $CloudDbHost -p $CloudDbPort -U $CloudDbUser -d $CloudDbName --data-only --table=auth.users --table=auth.identities --inserts > cloud_auth_users.sql
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Successfully dumped auth users to cloud_auth_users.sql" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to dump auth users" -ForegroundColor Red
            exit 1
        }
    }
    catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "💡 Make sure pg_dump is installed and in your PATH" -ForegroundColor Yellow
        exit 1
    }
    finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

# Step 2: Apply to local database
Write-Host "📥 Step 2: Applying auth users to local database..." -ForegroundColor Cyan

if (-not $DryRun) {
    try {
        # Clear existing auth users first (optional)
        Write-Host "🧹 Clearing existing local auth users..." -ForegroundColor Yellow
        docker exec -i supabase-db psql -U postgres -d postgres -c "TRUNCATE auth.users CASCADE; TRUNCATE auth.identities CASCADE;" | Out-Null

        # Apply the dump
        Get-Content cloud_auth_users.sql | docker exec -i supabase-db psql -U postgres -d postgres

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Successfully applied auth users to local database" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to apply auth users to local database" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "❌ Error applying to local database: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 3: Verification
Write-Host "🔍 Step 3: Verification..." -ForegroundColor Cyan

if (-not $DryRun) {
    Write-Host "Checking local auth users count:" -ForegroundColor Gray
    docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT COUNT(*) as user_count FROM auth.users;"

    Write-Host "Sample local auth users:" -ForegroundColor Gray
    docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, email, created_at FROM auth.users LIMIT 3;"
}

Write-Host ""
Write-Host "🎉 Auth users sync completed!" -ForegroundColor Green
Write-Host "📄 The dump file 'cloud_auth_users.sql' has been created for future use" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host ""
    Write-Host "🚀 To run the actual sync, execute:" -ForegroundColor Yellow
    Write-Host "./sync-auth-users.ps1 -DatabasePassword 'your-password'" -ForegroundColor Green
}
