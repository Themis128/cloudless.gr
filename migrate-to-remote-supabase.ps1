# migrate-to-remote-supabase.ps1

# Load .env variables
$envFile = ".env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^(?<key>[A-Za-z0-9_]+)=(?<val>.+)$") {
        [System.Environment]::SetEnvironmentVariable($matches['key'], $matches['val'])
    }
}

# Path to your local SQL dump file
$SqlFile = "local-backup.sql"

# Use SUPABASE_URL and password from .env
$SupabaseUrl = $env:SUPABASE_URL
$DbUser = "postgres"
$DbName = "postgres"

# Extract project ref from SUPABASE_URL (trim and robust regex)
$SupabaseUrl = $SupabaseUrl.Trim()
Write-Host "[DEBUG] SUPABASE_URL value: '$SupabaseUrl' (length: $($SupabaseUrl.Length))"
    $DbHost = "aws-0-eu-central-1.pooler.supabase.com"
    Write-Host "[DEBUG] Using provided Supabase host: $DbHost"

# Use DATABASE_URL password if present, else prompt
$DbPassword = "cloudless2025" # Default, update if needed
if ($env:DATABASE_URL -match ":([a-zA-Z0-9!@#$%^&*()_+\-=]+)@") {
    $DbPassword = $matches[1]
}

# Build connection string
$ConnStr = "postgresql://${DbUser}:${DbPassword}@${DbHost}:5432/${DbName}"

# Run migration
if (Test-Path $SqlFile) {
    Write-Host "Starting migration to remote Supabase..."
    psql $ConnStr -f $SqlFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration completed successfully."
    } else {
        Write-Host "❌ Migration failed. Check the error messages above."
    }
} else {
    Write-Host "❌ SQL file not found: $SqlFile"
}
