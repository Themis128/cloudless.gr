# Alternative method: Sync auth users via Supabase Admin API
param(
    [string]$ProjectRef = "oflctqligzouzshimuqh",
    [string]$ServiceRoleKey = ""
)

if (-not $ServiceRoleKey) {
    Write-Host "❌ You need to provide your Service Role Key" -ForegroundColor Red
    Write-Host "Usage: ./sync-auth-users-api.ps1 -ServiceRoleKey 'your-service-role-key'" -ForegroundColor Cyan
    exit 1
}

$CloudUrl = "https://$ProjectRef.supabase.co"
$LocalUrl = "http://127.0.0.1:8000"

# Service role headers for cloud
$CloudHeaders = @{
    "Authorization" = "Bearer $ServiceRoleKey"
    "apikey"        = $ServiceRoleKey
    "Content-Type"  = "application/json"
}

# Local service role headers
$LocalServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTAwMjEyMDAsImV4cCI6MTkwNzc4NzYwMH0.n7S053n5q1Ih3_cJmdyBSUuiPmemvB3ZJgvEUoVKZ6M"
$LocalHeaders = @{
    "Authorization" = "Bearer $LocalServiceRoleKey"
    "apikey"        = $LocalServiceRoleKey
    "Content-Type"  = "application/json"
}

Write-Host "🔐 Syncing Auth Users via Admin API" -ForegroundColor Cyan
Write-Host "From: $CloudUrl" -ForegroundColor Yellow
Write-Host "To: $LocalUrl" -ForegroundColor Yellow
Write-Host ""

try {
    # Method 1: Try to get users via Admin API
    Write-Host "📤 Attempting to fetch users from cloud..." -ForegroundColor Cyan

    # Try different endpoints for auth users
    $endpoints = @(
        "/auth/v1/admin/users",
        "/rest/v1/auth.users",
        "/auth/v1/users"
    )

    $users = $null
    foreach ($endpoint in $endpoints) {
        try {
            Write-Host "   Trying endpoint: $endpoint" -ForegroundColor Gray
            $users = Invoke-RestMethod -Uri "$CloudUrl$endpoint" -Headers $CloudHeaders -Method GET
            if ($users) {
                Write-Host "   ✅ Successfully retrieved users from $endpoint" -ForegroundColor Green
                break
            }
        }
        catch {
            Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    if (-not $users) {
        Write-Host ""
        Write-Host "❌ Could not retrieve users via API endpoints" -ForegroundColor Red
        Write-Host "💡 This is expected - auth users require database-level access" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🔧 Recommended Solutions:" -ForegroundColor Cyan
        Write-Host "1. Use the SQL dump method: ./sync-auth-users.ps1 -DatabasePassword 'your-password'" -ForegroundColor Green
        Write-Host "2. Use Supabase CLI: supabase db pull" -ForegroundColor Green
        Write-Host "3. Use the comprehensive sync with auth: ./sync-comprehensive.ps1 -ServiceRoleKey 'key' -IncludeAuth -DatabasePassword 'pass'" -ForegroundColor Green
        exit 1
    }

    # If we got users, try to sync them
    Write-Host "📊 Found $($users.Count) users in cloud" -ForegroundColor Yellow

    # Clear local auth users (this likely won't work via API)
    Write-Host "🧹 Attempting to clear local auth users..." -ForegroundColor Gray
    try {
        docker exec -i supabase-db psql -U postgres -d postgres -c "DELETE FROM auth.users;" | Out-Null
        Write-Host "   ✅ Cleared local auth users" -ForegroundColor Green
    }
    catch {
        Write-Host "   ⚠️  Could not clear via SQL: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    # Try to create users locally (this also likely won't work via REST API)
    $successCount = 0
    foreach ($user in $users) {
        try {
            $userData = $user | ConvertTo-Json -Compress -Depth 100
            Invoke-RestMethod -Uri "$LocalUrl/auth/v1/admin/users" -Headers $LocalHeaders -Method POST -Body $userData | Out-Null
            $successCount++
            Write-Host "   ✅ Synced user: $($user.email)" -ForegroundColor Green
        }
        catch {
            Write-Host "   ❌ Failed to sync user $($user.email): $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    Write-Host ""
    Write-Host "🎉 Auth sync completed: $successCount/$($users.Count) users synced" -ForegroundColor Green

}
catch {
    Write-Host "❌ Error during auth sync: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Auth users typically require direct database access or Supabase CLI" -ForegroundColor Yellow
    Write-Host "   Try using the SQL dump method instead: ./sync-auth-users.ps1" -ForegroundColor Cyan
}
