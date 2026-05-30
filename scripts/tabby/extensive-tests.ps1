#requires -Version 7
<#
.SYNOPSIS
  Extensive correctness, performance and reliability suite for the local
  Tabby + Pochi stack. Goes well beyond test-tabby.ps1.

.DESCRIPTION
  Groups:
    1. Health + metadata
    2. Auth (good token, bad token, no token)
    3. FIM completion across 6 languages (Python, JS, TS, Go, Rust, Bash)
    4. FIM edge cases (empty suffix, long prefix, unicode)
    5. Chat correctness (factual, code, refusal-style follow-up)
    6. Chat streaming throughput (tokens/s)
    7. Agentic tool-call patterns (read_file, list_files, two-step)
    8. Concurrency  4 parallel chat requests
    9. Sustained load  10 sequential FIM requests, latency stability
   10. VRAM occupancy snapshot

  Exit code = number of failed checks. Designed to be run with the
  server already up (D:\tabby\start-tabby.ps1) so cold-load cost
  doesn't dominate.
#>
[CmdletBinding()]
param(
  [int]$Port = 8080
)

$ErrorActionPreference = 'Continue'

# ── token from agent config ──────────────────────────────────────────────────
$cfgPath = Join-Path $env:USERPROFILE '.tabby-client\agent\config.toml'
if (-not (Test-Path $cfgPath)) { throw "Run setup-tabby.ps1 first." }
$token = (Get-Content $cfgPath | Select-String -Pattern '^\s*token\s*=\s*"([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
if (-not $token) { throw "No token in $cfgPath" }
$chatModel = (Get-Content $cfgPath | Select-String -Pattern '^\s*model\s*=\s*"([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
$H = @{ Authorization = "Bearer $token" }
$base = "http://127.0.0.1:$Port"

$script:results = New-Object System.Collections.Generic.List[PSCustomObject]
function Result([string]$group, [string]$name, [bool]$pass, [double]$ms, [string]$detail = '') {
  $script:results.Add([PSCustomObject]@{
    Group  = $group
    Name   = $name
    Pass   = $pass
    Ms     = [math]::Round($ms, 0)
    Detail = $detail
  })
  $sym = if ($pass) { '+' } else { 'X' }
  $color = if ($pass) { 'Green' } else { 'Red' }
  Write-Host ("  {0} {1,-55} {2,8} ms  {3}" -f $sym, $name, [math]::Round($ms, 0), $detail) -ForegroundColor $color
}

function Time-It([scriptblock]$body) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $out = & $body
  $sw.Stop()
  [PSCustomObject]@{ Ms = $sw.Elapsed.TotalMilliseconds; Out = $out }
}

function Chat([string]$system, [string]$user, [int]$maxTok = 200, [double]$temp = 0.2) {
  $body = @{
    model    = $chatModel
    messages = @(
      @{ role = 'system'; content = $system },
      @{ role = 'user';   content = $user }
    )
    temperature = $temp
    max_tokens  = $maxTok
    stream      = $true
  } | ConvertTo-Json -Depth 6 -Compress
  $r = Invoke-WebRequest "$base/v1/chat/completions" -Method Post -Body $body `
       -ContentType 'application/json' -Headers $H -UseBasicParsing -TimeoutSec 180
  ($r.Content -split "`n" | Where-Object { $_ -like 'data: {*' } | ForEach-Object {
    ($_.Substring(6) | ConvertFrom-Json).choices[0].delta.content
  }) -join ''
}

function Fim([string]$lang, [string]$prefix, [string]$suffix = '') {
  $body = @{
    language = $lang
    segments = @{ prefix = $prefix; suffix = $suffix }
  } | ConvertTo-Json -Depth 5 -Compress
  $r = Invoke-WebRequest "$base/v1/completions" -Method Post -Body $body `
       -ContentType 'application/json' -Headers $H -UseBasicParsing -TimeoutSec 120
  ($r.Content | ConvertFrom-Json).choices[0].text
}

# ════════════════════════════════════════════════════════════════════════════
# 1. HEALTH + METADATA
# ════════════════════════════════════════════════════════════════════════════
Write-Host "`n[1] health + metadata" -ForegroundColor Cyan
$t = Time-It { (Invoke-WebRequest "$base/v1/health" -Headers $H -UseBasicParsing -TimeoutSec 5).Content | ConvertFrom-Json }
Result '1.health' 'completion model loaded' ($t.Out.model -eq 'Qwen2.5-Coder-3B') $t.Ms $t.Out.model
Result '1.health' 'chat model loaded'       ($t.Out.chat_model -eq 'Qwen2.5-Coder-7B-Instruct') $t.Ms $t.Out.chat_model
Result '1.health' 'completion on CUDA'      ($t.Out.device -eq 'cuda') $t.Ms $t.Out.device
Result '1.health' 'chat on CUDA'            ($t.Out.chat_device -eq 'cuda') $t.Ms $t.Out.chat_device

$t = Time-It { (Invoke-WebRequest "$base/graphql" -Method Post -Body '{"query":"{__typename}"}' -ContentType 'application/json' -UseBasicParsing -TimeoutSec 5).StatusCode }
Result '1.health' 'graphql reachable' ($t.Out -eq 200) $t.Ms ("status=$($t.Out)")

# ════════════════════════════════════════════════════════════════════════════
# 2. AUTH
# ════════════════════════════════════════════════════════════════════════════
Write-Host "`n[2] auth" -ForegroundColor Cyan
$t = Time-It {
  try {
    Invoke-WebRequest "$base/v1/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop | Out-Null
    0
  } catch { $_.Exception.Response.StatusCode.value__ }
}
Result '2.auth' 'no-token returns 401' ($t.Out -eq 401) $t.Ms ("status=$($t.Out)")

$t = Time-It {
  try {
    Invoke-WebRequest "$base/v1/health" -Headers @{ Authorization = "Bearer bad-token-xxxx" } -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop | Out-Null
    0
  } catch { $_.Exception.Response.StatusCode.value__ }
}
Result '2.auth' 'wrong token returns 401' ($t.Out -eq 401) $t.Ms ("status=$($t.Out)")

$t = Time-It { (Invoke-WebRequest "$base/v1/health" -Headers $H -UseBasicParsing -TimeoutSec 5).StatusCode }
Result '2.auth' 'good token returns 200' ($t.Out -eq 200) $t.Ms

# ════════════════════════════════════════════════════════════════════════════
# 3. FIM ACROSS LANGUAGES
# ════════════════════════════════════════════════════════════════════════════
Write-Host "`n[3] FIM across languages" -ForegroundColor Cyan
$langs = @(
  @{ lang='python';     prefix="def fibonacci(n):`n    "; expect='return' }
  @{ lang='javascript'; prefix="function median(arr) {`n  arr.sort((a, b) => a - b);`n  "; expect='length' }
  @{ lang='typescript'; prefix="export function clamp(value: number, min: number, max: number): number {`n  "; expect='return' }
  @{ lang='go';         prefix="func reverse(s string) string {`n    runes := []rune(s)`n    "; expect='for' }
  @{ lang='rust';       prefix="fn factorial(n: u64) -> u64 {`n    if n == 0 {`n        1`n    } else {`n        "; expect='factorial' }
  @{ lang='shellscript';prefix="#!/usr/bin/env bash`nset -euo pipefail`n# count non-empty lines in a file`n"; expect='grep' }
)
foreach ($l in $langs) {
  $t = Time-It { Fim $l.lang $l.prefix }
  $hit = $t.Out -match $l.expect
  Result '3.fim-lang' ("fim:" + $l.lang) $hit $t.Ms ("expected `'$($l.expect)`' in output")
}

# ════════════════════════════════════════════════════════════════════════════
# 4. FIM EDGE CASES
# ════════════════════════════════════════════════════════════════════════════
Write-Host "`n[4] FIM edge cases" -ForegroundColor Cyan

# empty suffix
$t = Time-It { Fim 'python' "x = 1`ny = 2`nprint(" '' }
Result '4.fim-edge' 'empty suffix returns non-empty' (-not [string]::IsNullOrWhiteSpace($t.Out)) $t.Ms

# unicode in prefix
$t = Time-It { Fim 'python' "# Calcule la médiane d`'un tableau`ndef mediane(arr):`n    arr = sorted(arr)`n    " '' }
Result '4.fim-edge' 'unicode prefix returns non-empty' (-not [string]::IsNullOrWhiteSpace($t.Out)) $t.Ms

# very long prefix (~80 lines) — context-window stress
$longPrefix = "def cumsum(xs):`n    total = 0`n    out = []`n"
$longPrefix += ("    # padding`n" * 80)
$longPrefix += "    for x in xs:`n        "
$t = Time-It { Fim 'python' $longPrefix '' }
Result '4.fim-edge' 'long prefix accepted' (-not [string]::IsNullOrWhiteSpace($t.Out)) $t.Ms ("len(prefix)=$($longPrefix.Length)")

# with non-empty suffix (true FIM)
$t = Time-It { Fim 'python' "def add(a, b):`n    " "    return result`n" }
Result '4.fim-edge' 'FIM with suffix' (-not [string]::IsNullOrWhiteSpace($t.Out)) $t.Ms

# ════════════════════════════════════════════════════════════════════════════
# 5. CHAT CORRECTNESS
# ════════════════════════════════════════════════════════════════════════════
Write-Host "`n[5] chat correctness" -ForegroundColor Cyan

$t = Time-It { Chat "Reply with ONLY the answer. No prose." 'What is 17 multiplied by 23?' 16 0.0 }
Result '5.chat' 'arithmetic 17*23' ($t.Out -match '391') $t.Ms ("got: $($t.Out.Trim())")

$t = Time-It { Chat 'Return ONLY the code, no markdown fence.' 'Write a TypeScript function that returns true if a string is a palindrome.' 200 0.2 }
$hasFn = $t.Out -match 'function\s+\w+|=>\s*\{|return\s'
Result '5.chat' 'TS palindrome generates function' $hasFn $t.Ms

$t = Time-It { Chat 'Respond with one word: yes or no.' "Is JavaScript a statically typed language?" 8 0.0 }
Result '5.chat' 'factual no-question' ($t.Out -match '(?i)no') $t.Ms ("got: $($t.Out.Trim())")

# pure refusal: not really a refusal target, just check it stays on topic with system constraints
$t = Time-It { Chat 'You can only respond with valid JSON object literals. No prose.' "Return a JSON with key 'lang' value 'rust'." 60 0.0 }
$ok = $false
try { $j = $t.Out.Trim() -replace '^```json|```$','' | ConvertFrom-Json; $ok = ($j.lang -eq 'rust') } catch {}
Result '5.chat' 'JSON-only system constraint honored' $ok $t.Ms ("got: $($t.Out.Trim().Substring(0, [Math]::Min(40,$t.Out.Trim().Length)))")

# ════════════════════════════════════════════════════════════════════════════
# 6. CHAT THROUGHPUT (TTFT + steady-state tok/s)
# ════════════════════════════════════════════════════════════════════════════
# Measure both:
#   - time-to-first-token (TTFT): how long before any content lands
#   - steady-state tok/s: tokens generated AFTER first token / time since first
# Uses usage.completion_tokens from the final SSE chunk (Tabby/llama-server
# emit it). This is the honest "is the GPU actually working" metric and
# isolates wall time before generation begins from generation rate itself.
Write-Host "`n[6] chat throughput (TTFT + steady tok/s)" -ForegroundColor Cyan

$body = @{
  model    = $chatModel
  messages = @(@{ role='user'; content='Write a Python function that returns the first 30 prime numbers. Include the full function body.' })
  max_tokens = 300
  stream   = $true
  stream_options = @{ include_usage = $true }
} | ConvertTo-Json -Depth 6 -Compress

$req = [System.Net.WebRequest]::Create("$base/v1/chat/completions")
$req.Method = 'POST'
$req.ContentType = 'application/json'
$req.Headers['Authorization'] = "Bearer $token"
$req.Timeout = 180000
$bytes = [Text.Encoding]::UTF8.GetBytes($body)
$req.ContentLength = $bytes.Length
$reqStream = $req.GetRequestStream(); $reqStream.Write($bytes, 0, $bytes.Length); $reqStream.Close()

$sw = [Diagnostics.Stopwatch]::StartNew()
$resp = $req.GetResponse()
$reader = [IO.StreamReader]::new($resp.GetResponseStream())
$ttft = $null
$completionToks = 0
$text = New-Object Text.StringBuilder
while (-not $reader.EndOfStream) {
  $line = $reader.ReadLine()
  if (-not $line.StartsWith('data: ')) { continue }
  if ($line -eq 'data: [DONE]') { break }
  $obj = $line.Substring(6) | ConvertFrom-Json
  $c = $obj.choices[0].delta.content
  if ($c -and -not $ttft) { $ttft = $sw.Elapsed.TotalMilliseconds }
  if ($c) { [void]$text.Append($c) }
  if ($obj.usage -and $obj.usage.completion_tokens) { $completionToks = $obj.usage.completion_tokens }
}
$sw.Stop()
$reader.Close(); $resp.Close()

$genMs = $sw.Elapsed.TotalMilliseconds - $ttft
$tps = if ($completionToks -gt 0 -and $genMs -gt 0) { [math]::Round($completionToks * 1000.0 / $genMs, 1) } else { 0 }
Result '6.throughput' "TTFT ms" ($ttft -lt 3000) $ttft ("first token after $([math]::Round($ttft, 0)) ms")
# Expected steady-state on RTX 3070 Laptop (8 GB) with Qwen2.5-Coder-7B Q4
# AND the 3B FIM model co-resident in VRAM: 5-10 tok/s. Anything below 5
# tok/s signals CPU fallback, GPU contention, or thermal throttling.
Result '6.throughput' "steady tok/s ($completionToks tok)" ($tps -ge 5) $sw.Elapsed.TotalMilliseconds ("$tps tok/s")

# ════════════════════════════════════════════════════════════════════════════
# 7. AGENTIC TOOL-CALL PATTERNS
# ════════════════════════════════════════════════════════════════════════════
Write-Host "`n[7] agentic tool-call patterns" -ForegroundColor Cyan

$sys = 'You are a coding agent. Available tools (call via XML, one per turn, then stop): ' +
       '<read_file path="X"/>, <list_files dir="X"/>, <write_file path="X">CONTENT</write_file>. ' +
       'Output ONLY the tool tag, no prose.'

$t = Time-It { Chat $sys 'Read the README.md file at the repo root.' 80 0.1 }
Result '7.agent' 'emits <read_file>' ($t.Out -match '<read_file[^>]*path=["''][^"'']*README\.md') $t.Ms

$t = Time-It { Chat $sys 'List files in the src/lib directory.' 80 0.1 }
Result '7.agent' 'emits <list_files>' ($t.Out -match '<list_files[^>]*dir=["''][^"'']*src/lib') $t.Ms

# Two-step: model gets fake tool output, picks NEXT tool. Tests multi-turn coherence.
$body = @{
  model    = $chatModel
  messages = @(
    @{ role='system';    content=$sys },
    @{ role='user';      content='Read README.md, then list files in src/.' },
    @{ role='assistant'; content='<read_file path="README.md"/>' },
    @{ role='user';      content='Tool result for <read_file path="README.md"/>:\n# Cloudless\nWelcome.\n\nNow continue.' }
  )
  max_tokens = 80
  temperature = 0.1
  stream   = $true
} | ConvertTo-Json -Depth 8 -Compress
$sw = [Diagnostics.Stopwatch]::StartNew()
$r = Invoke-WebRequest "$base/v1/chat/completions" -Method Post -Body $body -ContentType 'application/json' -Headers $H -UseBasicParsing -TimeoutSec 120
$sw.Stop()
$text2 = ($r.Content -split "`n" | Where-Object { $_ -like 'data: {*' } | ForEach-Object {
  ($_.Substring(6) | ConvertFrom-Json).choices[0].delta.content
}) -join ''
Result '7.agent' 'multi-turn: picks list_files next' ($text2 -match '<list_files') $sw.Elapsed.TotalMilliseconds ($text2.Trim().Substring(0,[Math]::Min(60,$text2.Trim().Length)))

# ════════════════════════════════════════════════════════════════════════════
# 8. CONCURRENCY  4 parallel chat requests
# ════════════════════════════════════════════════════════════════════════════
Write-Host "`n[8] concurrency  4 parallel chat" -ForegroundColor Cyan
$prompts = @(
  'Return ONLY the number: 1+1',
  'Return ONLY the number: 2+2',
  'Return ONLY the number: 3+3',
  'Return ONLY the number: 4+4'
)
$expect = @('2','4','6','8')

$sw = [Diagnostics.Stopwatch]::StartNew()
$jobs = for ($i = 0; $i -lt 4; $i++) {
  Start-ThreadJob -ScriptBlock {
    param($b, $H, $prompt, $model)
    $body = @{
      model    = $model
      messages = @(@{ role='user'; content=$prompt })
      max_tokens = 8
      temperature = 0.0
      stream   = $true
    } | ConvertTo-Json -Depth 6 -Compress
    $r = Invoke-WebRequest "$b/v1/chat/completions" -Method Post -Body $body -ContentType 'application/json' -Headers $H -UseBasicParsing -TimeoutSec 120
    ($r.Content -split "`n" | Where-Object { $_ -like 'data: {*' } | ForEach-Object {
      ($_.Substring(6) | ConvertFrom-Json).choices[0].delta.content
    }) -join ''
  } -ArgumentList $base, $H, $prompts[$i], $chatModel
}
$outs = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job
$sw.Stop()

$matched = 0
for ($i = 0; $i -lt $outs.Count; $i++) {
  if ($outs[$i] -match $expect[$i]) { $matched++ }
}
Result '8.concurrency' "$matched/4 parallel chats correct" ($matched -ge 3) $sw.Elapsed.TotalMilliseconds ("wallclock for 4 in parallel")

# ════════════════════════════════════════════════════════════════════════════
# 9. SUSTAINED FIM LOAD  10 sequential requests
# ════════════════════════════════════════════════════════════════════════════
Write-Host "`n[9] sustained FIM x10" -ForegroundColor Cyan
$lats = @()
for ($i = 0; $i -lt 10; $i++) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $null = Fim 'python' "def square(x):`n    " ''
  $sw.Stop()
  $lats += $sw.Elapsed.TotalMilliseconds
}
$avg = [math]::Round(($lats | Measure-Object -Average).Average, 0)
$max = [math]::Round(($lats | Measure-Object -Maximum).Maximum, 0)
$min = [math]::Round(($lats | Measure-Object -Minimum).Minimum, 0)
$p95 = [math]::Round(($lats | Sort-Object)[8], 0)  # 9th of 10 ~= p95
$stable = $max -lt ($avg * 4)
Result '9.sustained' "10x FIM: avg/min/max/p95 ms" $stable $avg ("avg=$avg min=$min max=$max p95=$p95")

# ════════════════════════════════════════════════════════════════════════════
# 10. VRAM SNAPSHOT
# ════════════════════════════════════════════════════════════════════════════
Write-Host "`n[10] VRAM snapshot" -ForegroundColor Cyan
try {
  $smi = nvidia-smi --query-gpu=memory.used,memory.free,memory.total --format=csv,noheader,nounits
  $parts = $smi -split ',\s*' | ForEach-Object { [int]$_ }
  $used = $parts[0]; $free = $parts[1]; $total = $parts[2]
  $cushion = $free -gt 500
  Result '10.vram' "used/free/total MiB" $cushion 0 ("used=$used free=$free total=$total")
} catch {
  Result '10.vram' 'nvidia-smi unavailable' $false 0 $_.Exception.Message
}

# ════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════════════════════════════════
$pass = ($script:results | Where-Object { $_.Pass }).Count
$fail = ($script:results | Where-Object { -not $_.Pass }).Count
$tot  = $script:results.Count

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RESULTS: $pass / $tot pass, $fail fail" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
Write-Host "========================================" -ForegroundColor Cyan

if ($fail -gt 0) {
  Write-Host "`nFailures:" -ForegroundColor Red
  $script:results | Where-Object { -not $_.Pass } | Format-Table -AutoSize Group, Name, Ms, Detail
}

# Latency table by group
Write-Host "`nLatency summary (ms):" -ForegroundColor Cyan
$script:results | Group-Object Group | ForEach-Object {
  $items = $_.Group
  $avg = [math]::Round(($items.Ms | Measure-Object -Average).Average, 0)
  $max = [math]::Round(($items.Ms | Measure-Object -Maximum).Maximum, 0)
  [PSCustomObject]@{ Group = $_.Name; Count = $items.Count; AvgMs = $avg; MaxMs = $max }
} | Format-Table -AutoSize

exit $fail
