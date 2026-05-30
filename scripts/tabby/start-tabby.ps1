#requires -Version 7
<#
.SYNOPSIS
  Start the local Tabby server on Windows + RTX 3070.

.DESCRIPTION
  Loads both models on CUDA and serves /v1/completions (FIM),
  /v1/chat/completions (OpenAI-compatible), and /v1/health.

  Models:
    completion (FIM):  Qwen2.5-Coder-3B          (~1.5 GB Q4 on GPU)
    chat / agent:      Qwen2.5-Coder-7B-Instruct (~4.7 GB Q4 on GPU)
    total:             ~6.2 GB of 7.4 GB free VRAM

  Override with -Port, -CompletionModel, -ChatModel.
#>
[CmdletBinding()]
param(
  [int]   $Port             = 8080,
  [string]$CompletionModel  = 'Qwen2.5-Coder-3B',
  [string]$ChatModel        = 'Qwen2.5-Coder-7B-Instruct',
  [string]$InstallRoot      = 'D:\tabby',
  [int]   $Parallelism      = 1
)

$ErrorActionPreference = 'Stop'

$tabbyExe = Join-Path $InstallRoot 'current\tabby.exe'
if (-not (Test-Path $tabbyExe)) {
  throw "tabby.exe not found at $tabbyExe -- run scripts\tabby\setup-tabby.ps1 first."
}

if (-not $env:TABBY_MODEL_CACHE_ROOT) {
  $env:TABBY_MODEL_CACHE_ROOT = Join-Path $InstallRoot 'models'
}

Write-Host "[tabby] starting on port $Port" -ForegroundColor Cyan
Write-Host "[tabby] model cache: $($env:TABBY_MODEL_CACHE_ROOT)"
Write-Host "[tabby] completion : $CompletionModel (cuda)"
Write-Host "[tabby] chat       : $ChatModel (cuda)"
Write-Host "[tabby] parallelism: $Parallelism"

& $tabbyExe serve `
  --model $CompletionModel `
  --chat-model $ChatModel `
  --device cuda `
  --chat-device cuda `
  --parallelism $Parallelism `
  --host 127.0.0.1 `
  --port $Port
