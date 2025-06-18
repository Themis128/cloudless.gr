# Direct Docker Database Sync Commands
# Run these commands step by step

# 1. First, make sure your local Supabase is running
Write-Host "Starting Supabase services..." -ForegroundColor Green
docker-compose -f docker/docker-compose.yml up -d

# Wait for services to be ready
Start-Sleep -Seconds 10

# 2. Get your cloud database credentials
Write-Host @"
Get your cloud database credentials from:
https://supabase.com/dashboard/project/oflctqligzouzshimuqh/settings/database

You'll need:
- Host: db.oflctqligzouzshimuqh.supabase.co
- Database: postgres
- Username: postgres
- Password: [from dashboard]
- Port: 5432
"@ -ForegroundColor Yellow

# 3. Create a temporary container with pg_dump to connect to cloud
$CloudHost = "db.oflctqligzouzshimuqh.supabase.co"
$CloudPort = "5432"
$CloudDB = "postgres"
$CloudUser = "postgres"

Write-Host "Run this command with your cloud password:" -ForegroundColor Cyan
Write-Host "docker run --rm -it postgres:15 pg_dump -h $CloudHost -p $CloudPort -U $CloudUser -d $CloudDB --clean --if-exists > cloud_dump.sql" -ForegroundColor White

Write-Host "Then restore to local:" -ForegroundColor Cyan
Write-Host "docker exec -i supabase-db psql -U postgres -d postgres < cloud_dump.sql" -ForegroundColor White

# 4. Alternative: Sync specific tables only
Write-Host @"

Alternative - Sync specific tables:

# Export specific table from cloud
docker run --rm -it postgres:15 pg_dump -h $CloudHost -p $CloudPort -U $CloudUser -d $CloudDB -t public.user_profiles > user_profiles.sql

# Import to local
docker exec -i supabase-db psql -U postgres -d postgres < user_profiles.sql

# Repeat for other tables:
# - projects
# - notifications
# - user_activity
# - user_preferences
"@ -ForegroundColor Yellow
