# Migrate local Docker Supabase database to remote Supabase
# Usage: .\migrate-local-to-remote-supabase.ps1 -RemoteHost <remote_host> -RemotePassword <remote_password>
# Example: .\migrate-local-to-remote-supabase.ps1 -RemoteHost aws-0-eu-central-1.pooler.supabase.com -RemotePassword mypassword

param(
    [Parameter(Mandatory=$true)]
    [string]$RemoteHost,
    [Parameter(Mandatory=$true)]
    [string]$RemotePassword
)

$LocalDump = "local-backup.dump"

Write-Host "[1/4] Exporting local Docker Supabase database..." -ForegroundColor Cyan
docker exec supabase-db pg_dump -U postgres -d postgres -Fc -f /tmp/$LocalDump
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to dump local database."; exit 1 }
docker cp supabase-db:/tmp/$LocalDump ./$LocalDump
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to copy dump file from container."; exit 1 }

Write-Host "[2/4] Restoring dump to remote Supabase..." -ForegroundColor Cyan
$env:PGPASSWORD = $RemotePassword
pg_restore --clean --no-owner --no-privileges -h $RemoteHost -U postgres -d postgres ./$LocalDump
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to restore dump to remote database."; exit 1 }

Write-Host "[3/4] Cleaning up local dump file..." -ForegroundColor Cyan
Remove-Item ./$LocalDump -Force

Write-Host "[4/4] Migration complete!" -ForegroundColor Green
