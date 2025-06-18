# PowerShell script to sync Supabase cloud data to local Docker instance
param(
    [string]$ProjectRef = "oflctqligzouzshimuqh",
    [string]$ServiceRoleKey = "",
    [switch]$IncludeAuth = $false
)

if (-not $ServiceRoleKey) {
    Write-Host "You need to provide your Service Role Key from Supabase Dashboard" -ForegroundColor Red
    Write-Host "1. Go to https://supabase.com/dashboard/project/$ProjectRef" -ForegroundColor Yellow
    Write-Host "2. Go to Settings -> API" -ForegroundColor Yellow
    Write-Host "3. Copy the 'service_role' key (starts with 'eyJ...')" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Usage: ./sync-supabase.ps1 -ServiceRoleKey 'your-key-here'" -ForegroundColor Cyan
    exit 1
}

$CloudUrl = "https://$ProjectRef.supabase.co"
$LocalUrl = "http://127.0.0.1:54321"
$Headers = @{
    "Authorization" = "Bearer $ServiceRoleKey"
    "apikey"        = $ServiceRoleKey
    "Content-Type"  = "application/json"
}

Write-Host "Syncing from Cloud: $CloudUrl" -ForegroundColor Green
Write-Host "To Local: $LocalUrl" -ForegroundColor Green

# Function to sync a table
function Sync-Table {
    param($TableName)

    Write-Host "Syncing table: $TableName" -ForegroundColor Cyan

    try {
        # Get data from cloud
        $CloudData = Invoke-RestMethod -Uri "$CloudUrl/rest/v1/$TableName" -Headers $Headers -Method GET

        if ($CloudData.Count -gt 0) {
            Write-Host "Found $($CloudData.Count) records in cloud $TableName" -ForegroundColor Yellow

            # Clear local table first
            docker exec -i supabase-db psql -U postgres -d postgres -c "TRUNCATE TABLE public.$TableName CASCADE;"

            # Insert each record to local
            foreach ($record in $CloudData) {
                $jsonData = $record | ConvertTo-Json -Compress
                try {
                    Invoke-RestMethod -Uri "$LocalUrl/rest/v1/$TableName" -Headers $Headers -Method POST -Body $jsonData
                    Write-Host "✓ Synced record to $TableName" -ForegroundColor Green
                }
                catch {
                    Write-Host "✗ Failed to sync record to $TableName : $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
        else {
            Write-Host "No records found in cloud $TableName" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "Error syncing $TableName : $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Sync common tables
$TablesToSync = @(
    "user_profiles",
    "projects",
    "notifications",
    "user_activity",
    "user_preferences"
)

foreach ($table in $TablesToSync) {
    Sync-Table -TableName $table
}

if ($IncludeAuth) {
    Write-Host "Note: Auth users sync requires special handling via SQL dump" -ForegroundColor Yellow
}

Write-Host "Sync completed!" -ForegroundColor Green
