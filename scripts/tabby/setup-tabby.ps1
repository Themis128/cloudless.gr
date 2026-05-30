#requires -Version 7
<#
.SYNOPSIS
  One-shot setup for a local Tabby + Pochi stack on Windows + NVIDIA GPU.

.DESCRIPTION
  Idempotent installer:
   1. Download the Tabby Windows-CUDA124 release.
   2. Symlink D:\tabby\current to the unpacked release.
   3. Pre-download the GGUF models.
   4. Launch the server, register a local admin user via GraphQL,
      capture the long-lived authToken.
   5. Write Tabby agent config (~/.tabby-client/agent/config.toml) and
      Pochi config (~/.pochi/config.jsonc) with that token.
   6. Stop the server so the user can start it deliberately with
      scripts\tabby\start-tabby.ps1.

  Models default to:
    completion  Qwen2.5-Coder-3B
    chat        Qwen2.5-Coder-7B-Instruct
  Override with -CompletionModel / -ChatModel.

.NOTES
  Designed for the developer's RTX 3070 Laptop (8 GB) box. Re-running is safe:
  it skips downloads when the binary or model is already present, and reuses
  an existing admin user if one was registered before.
#>
[CmdletBinding()]
param(
  [string]$Version          = 'v0.32.0',
  [string]$InstallRoot      = 'D:\tabby',
  [string]$CompletionModel  = 'Qwen2.5-Coder-3B',
  [string]$ChatModel        = 'Qwen2.5-Coder-7B-Instruct',
  [string]$AdminEmail       = 'admin@cloudless.local',
  [string]$AdminPassword    = 'TabbyLocalAdmin1!',
  [int]   $Port             = 8080
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

function Log([string]$msg) { Write-Host "[setup-tabby] $msg" -ForegroundColor Cyan }

# ── 1. download + extract Tabby ──────────────────────────────────────────────
$null = New-Item -ItemType Directory -Path $InstallRoot -Force
$releaseDir = Join-Path $InstallRoot $Version
$exePath    = Join-Path $releaseDir 'tabby_x86_64-windows-msvc-cuda124\tabby.exe'

if (-not (Test-Path $exePath)) {
  $zip = Join-Path $InstallRoot "tabby_$Version.zip"
  $url = "https://github.com/TabbyML/tabby/releases/download/$Version/tabby_x86_64-windows-msvc-cuda124.zip"
  Log "downloading $url"
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  Log "extracting to $releaseDir"
  Expand-Archive -Path $zip -DestinationPath $releaseDir -Force
  Remove-Item $zip
} else {
  Log "tabby.exe already present at $exePath"
}

# stable path: D:\tabby\current -> versioned dir
$current = Join-Path $InstallRoot 'current'
if (Test-Path $current) { (Get-Item $current).Delete() }
$null = New-Item -ItemType SymbolicLink -Path $current -Target (Split-Path $exePath -Parent)

# ── 2. download models ───────────────────────────────────────────────────────
$env:TABBY_MODEL_CACHE_ROOT = Join-Path $InstallRoot 'models'
$null = New-Item -ItemType Directory -Path $env:TABBY_MODEL_CACHE_ROOT -Force

foreach ($m in @($CompletionModel, $ChatModel)) {
  Log "ensuring model: $m"
  & (Join-Path $current 'tabby.exe') download --model $m 2>&1 | Where-Object { $_ -match 'ready|new file|Checksum' } | ForEach-Object { Write-Host "  $_" }
}

# ── 3. launch Tabby in the background just long enough to register admin ─────
$logDir = Join-Path $InstallRoot 'logs'
$null = New-Item -ItemType Directory -Path $logDir -Force
$setupLog = Join-Path $logDir 'setup.log'

# Free the port if a previous process is still bound to it
Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Log "starting tabby on port $Port (will stop after registration)"
$args = @(
  'serve',
  '--model', $CompletionModel,
  '--chat-model', $ChatModel,
  '--device', 'cuda',
  '--chat-device', 'cuda',
  '--parallelism', '1',
  '--host', '127.0.0.1',
  '--port', "$Port"
)
$proc = Start-Process -FilePath (Join-Path $current 'tabby.exe') -ArgumentList $args `
  -RedirectStandardOutput $setupLog -RedirectStandardError "$setupLog.err" `
  -WindowStyle Hidden -PassThru

# wait for /graphql to answer (separate from /v1/health which is auth-gated)
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
  try {
    $null = Invoke-WebRequest "http://127.0.0.1:$Port/graphql" -Method Post `
      -Body '{"query":"{__typename}"}' -ContentType 'application/json' `
      -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    $ready = $true
    break
  } catch { Start-Sleep -Seconds 2 }
}
if (-not $ready) { throw "tabby did not come up within 180s. Check $setupLog" }
Log "tabby is up"

# ── 4. register first admin user (or login if it already exists) ─────────────
function Invoke-Gql([string]$query, [hashtable]$vars = @{}, [string]$bearer = $null) {
  $headers = @{}
  if ($bearer) { $headers.Authorization = "Bearer $bearer" }
  $body = @{ query = $query; variables = $vars } | ConvertTo-Json -Depth 8 -Compress
  $r = Invoke-WebRequest "http://127.0.0.1:$Port/graphql" -Method Post -Body $body `
    -ContentType 'application/json' -Headers $headers -UseBasicParsing
  $r.Content | ConvertFrom-Json
}

$regMutation = 'mutation R($e:String!,$p:String!,$n:String!){register(email:$e,password1:$p,password2:$p,name:$n){accessToken}}'
$reg = Invoke-Gql $regMutation @{ e = $AdminEmail; p = $AdminPassword; n = 'admin' }

if ($reg.errors) {
  Log "register failed (probably already registered), trying login"
  $login = Invoke-Gql 'mutation A($e:String!,$p:String!){tokenAuth(email:$e,password:$p){accessToken}}' @{ e = $AdminEmail; p = $AdminPassword }
  if ($login.errors) {
    throw "Could not register or login: $($login.errors | ConvertTo-Json -Depth 5)"
  }
  $jwt = $login.data.tokenAuth.accessToken
} else {
  $jwt = $reg.data.register.accessToken
}

$me = Invoke-Gql '{me{email name authToken}}' @{} $jwt
$tabbyToken = $me.data.me.authToken
Log "admin authToken: $($tabbyToken.Substring(0,10))..."

# ── 5. stop the registration-time process ────────────────────────────────────
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Log "stopped setup process"

# ── 6. write client configs ──────────────────────────────────────────────────
$tabbyClientDir = Join-Path $env:USERPROFILE '.tabby-client\agent'
$null = New-Item -ItemType Directory -Path $tabbyClientDir -Force
$tabbyConfigPath = Join-Path $tabbyClientDir 'config.toml'
@"
## Tabby agent configuration  generated by scripts\tabby\setup-tabby.ps1
##
## Server: local Tabby on Windows + RTX 3070 (8 GB)
## Models: $CompletionModel (FIM) + $ChatModel (chat) on CUDA

[server]
endpoint = "http://127.0.0.1:$Port"
# Long-lived admin authToken minted at setup. Loopback only.
token = "$tabbyToken"

[completion]
trigger = { mode = "auto" }

[completion.prompt]
max_prefix_lines = 30
max_suffix_lines = 12

[chat]
model = "$ChatModel"

[logs]
level = "error"

[anonymousUsageTracking]
disable = true
"@ | Set-Content -Encoding ASCII $tabbyConfigPath
Log "wrote $tabbyConfigPath"

$pochiConfigDir = Join-Path $env:USERPROFILE '.pochi'
$null = New-Item -ItemType Directory -Path $pochiConfigDir -Force
$pochiConfigPath = Join-Path $pochiConfigDir 'config.jsonc'
@"
// Pochi configuration  generated by scripts\tabby\setup-tabby.ps1
//
// Schema: https://app.getpochi.com/config.schema.json
// `kind: "openai"` covers any OpenAI-compatible HTTP endpoint, including
// llama.cpp / Tabby's chat endpoint.
//
// `useToolCallMiddleware: true` is the critical flag for agentic flows on
// local models: Tabby's chat endpoint is a thin llama-server wrapper that
// does NOT emit OpenAI-shape `tool_calls` chunks, so Pochi falls back to a
// client-side XML-tag parser that reads tool invocations out of plain
// model output. Required for the Pochi agent loop to work locally.
{
  "`$schema": "https://app.getpochi.com/config.schema.json",
  "providers": {
    "tabby-local": {
      "kind": "openai",
      "name": "Tabby (local)",
      "baseURL": "http://127.0.0.1:$Port/v1",
      "apiKey": "$tabbyToken",
      "models": {
        "$ChatModel": {
          "name": "Qwen2.5 Coder 7B (local)",
          "contextWindow": 32768,
          "maxTokens": 4096,
          "useToolCallMiddleware": true
        }
      }
    }
  }
}
"@ | Set-Content -Encoding ASCII $pochiConfigPath
Log "wrote $pochiConfigPath"

# stash creds locally (hidden) for re-use across reinstalls
$credsPath = Join-Path $InstallRoot 'local-admin-creds.json'
@{
  email     = $AdminEmail
  password  = $AdminPassword
  authToken = $tabbyToken
  createdAt = (Get-Date -Format 'yyyy-MM-dd')
} | ConvertTo-Json | Set-Content -Encoding ASCII $credsPath
(Get-Item $credsPath).Attributes = 'Hidden'

Log "done. Start the server with: pwsh scripts\tabby\start-tabby.ps1"
