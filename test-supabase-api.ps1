param (
    [Parameter(Mandatory = $true)][string]$service,
    [Parameter(Mandatory = $false)][string]$endpoint = ""
)

# --- Load .env ---
$envPath = ".\.env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^\s*([^#=]+?)\s*=\s*(.*)\s*$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim('"')
            [System.Environment]::SetEnvironmentVariable($name, $value)
        }
    }
} else {
    Write-Host "ERROR: .env file not found." -ForegroundColor Red
    exit 1
}

# --- Validate API key ---
$anonKey = $env:SUPABASE_ANON_KEY
if (-not $anonKey) {
    Write-Host "ERROR: SUPABASE_ANON_KEY not found in .env" -ForegroundColor Red
    exit 1
}

# --- Build URL based on service ---
$baseUrl = "http://localhost:8000"
$paths = @{
    rest     = "$baseUrl/rest/v1"
    auth     = "$baseUrl/auth/v1"
    storage  = "$baseUrl/storage/v1"
    realtime = "$baseUrl/realtime/v1"
    edge     = "$baseUrl/functions/v1"
}

if (-not $paths.ContainsKey($service)) {
    Write-Host "ERROR: Unknown service '$service'" -ForegroundColor Red
    Write-Host "Valid options: rest, auth, storage, realtime, edge"
    exit 1
}

$fullUrl = $paths[$service]
if ($endpoint) {
    $fullUrl = "$fullUrl/$endpoint"
}

# --- Make API call ---
Write-Host "Calling: $fullUrl" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $fullUrl -Headers @{
        "apikey"        = $anonKey
        "Authorization" = "Bearer $anonKey"
    } -UseBasicParsing

    Write-Host "Response:" -ForegroundColor Green
    $response.Content
}
catch {
    $msg = $_.Exception.Message
    Write-Host ("Request failed: {0}" -f $msg) -ForegroundColor Red
}
