#requires -Version 7
<#
.SYNOPSIS
  Smoke-test the local Tabby server: health, FIM completion, chat streaming.

.DESCRIPTION
  Exits 0 if all three checks pass, 1 otherwise. Pulls the auth token from
  the Tabby agent config (the canonical place clients read from), so this
  script does not need any secret arguments and stays committable.

  Expected runtime on RTX 3070 Laptop:
    health             < 100ms
    FIM completion     ~3-5s for a 30-line prefix
    chat (1-token)     ~1-2s
#>
[CmdletBinding()]
param(
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'

# Read auth token from the Tabby agent config the IDE extension uses
$cfgPath = Join-Path $env:USERPROFILE '.tabby-client\agent\config.toml'
if (-not (Test-Path $cfgPath)) { throw "Tabby agent config not found at $cfgPath. Run setup-tabby.ps1 first." }
$token = (Get-Content $cfgPath | Select-String -Pattern '^\s*token\s*=\s*"([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value }) | Select-Object -First 1
if (-not $token) { throw "No token in $cfgPath. Re-run setup-tabby.ps1." }
$H = @{ Authorization = "Bearer $token" }

$pass = 0
$fail = 0
function Check([string]$name, [scriptblock]$body) {
  Write-Host "[test-tabby] $name" -ForegroundColor Cyan
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    & $body
    $sw.Stop()
    Write-Host "  PASS ($($sw.Elapsed.TotalMilliseconds.ToString('F0')) ms)" -ForegroundColor Green
    $script:pass++
  } catch {
    $sw.Stop()
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
    $script:fail++
  }
}

Check 'health' {
  $r = Invoke-WebRequest "http://127.0.0.1:$Port/v1/health" -Headers $H -UseBasicParsing -TimeoutSec 5
  $h = $r.Content | ConvertFrom-Json
  if (-not $h.model)      { throw 'no completion model loaded' }
  if (-not $h.chat_model) { throw 'no chat model loaded' }
  Write-Host "  completion = $($h.model) on $($h.device)"
  Write-Host "  chat       = $($h.chat_model) on $($h.chat_device)"
}

Check 'completion (FIM)' {
  $body = @{ language = 'python'; segments = @{ prefix = "def fibonacci(n):`n    "; suffix = '' } } | ConvertTo-Json -Depth 5 -Compress
  $r = Invoke-WebRequest "http://127.0.0.1:$Port/v1/completions" -Method Post -Body $body `
    -ContentType 'application/json' -Headers $H -UseBasicParsing -TimeoutSec 120
  $res = $r.Content | ConvertFrom-Json
  if (-not $res.choices[0].text) { throw 'empty completion' }
  Write-Host "  first line: $(($res.choices[0].text -split "`n")[0])"
}

Check 'chat (streaming)' {
  $body = @{
    model    = (Get-Content $cfgPath | Select-String -Pattern '^\s*model\s*=\s*"([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
    messages = @(@{ role = 'user'; content = 'Reply with the single word: pong' })
    max_tokens = 8
    stream   = $true
  } | ConvertTo-Json -Depth 6 -Compress
  $r = Invoke-WebRequest "http://127.0.0.1:$Port/v1/chat/completions" -Method Post -Body $body `
    -ContentType 'application/json' -Headers $H -UseBasicParsing -TimeoutSec 60
  $text = ($r.Content -split "`n" | Where-Object { $_ -like 'data: {*' } | ForEach-Object {
    ($_.Substring(6) | ConvertFrom-Json).choices[0].delta.content
  }) -join ''
  if ([string]::IsNullOrWhiteSpace($text)) { throw 'empty chat response' }
  Write-Host "  reply: $($text.Trim())"
}

Write-Host ""
if ($fail -gt 0) {
  Write-Host "[test-tabby] $pass passed, $fail failed" -ForegroundColor Red
  exit 1
}
Write-Host "[test-tabby] $pass passed" -ForegroundColor Green
exit 0
