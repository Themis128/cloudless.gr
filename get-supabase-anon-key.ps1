function Get-SupabaseAnonKey {
    param (
        [string]$EnvFilePath = ".env",
        [string]$DockerContainer = "supabase-auth",
        [string]$GotrueConfigPath = ".\volumes\auth\config\gotrue.conf.json"
    )

    # 1. Check .env file
    if (Test-Path $EnvFilePath) {
        $lines = Get-Content $EnvFilePath
        foreach ($line in $lines) {
            if ($line -match "^\s*SUPABASE_ANON_KEY\s*=\s*(.+)$") {
                $key = $matches[1].Trim('"')
                Write-Host "Found SUPABASE_ANON_KEY in .env"
                return $key
            }
        }
    }

    # 2. Try Docker container env
    $dockerEnv = docker exec $DockerContainer printenv SUPABASE_ANON_KEY 2>$null
    if ($dockerEnv) {
        Write-Host "Found SUPABASE_ANON_KEY in Docker container"
        return $dockerEnv
    }

    # 3. Check gotrue config JSON
    if (Test-Path $GotrueConfigPath) {
        $json = Get-Content $GotrueConfigPath -Raw | ConvertFrom-Json
        if ($json.jwt -and $json.jwt.secret) {
            Write-Host "Found SUPABASE_ANON_KEY in gotrue.conf.json"
            return $json.jwt.secret
        }
    }

    Write-Host "SUPABASE_ANON_KEY not found in .env, Docker, or config JSON" -ForegroundColor Red
    return $null
}

# --- Example usage ---
$key = Get-SupabaseAnonKey
if ($key) {
    Write-Host "Your SUPABASE_ANON_KEY is:" -ForegroundColor Cyan
    Write-Host $key -ForegroundColor Green
}
