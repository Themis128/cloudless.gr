# Verify Phase 1 of the Integration Improvement Plan.
#
# Runs typecheck + Vitest against just the new integrationFetch wrapper and
# its tests. Designed to land cleanly before committing the phase-1 PR.
#
# Run with: pwsh -File scripts\verify-phase1-integration-http.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path "D:\cloudless.gr"

Write-Host "==> 1. Confirm the new files exist" -ForegroundColor Cyan
$paths = @(
    "src/lib/integrations/http.ts",
    "__tests__/integrations-http.test.ts"
)
foreach ($p in $paths) {
    if (-not (Test-Path $p)) {
        Write-Host "    MISSING: $p" -ForegroundColor Red
        exit 1
    }
    Write-Host "    + $p"
}

Write-Host ""
Write-Host "==> 2. pnpm typecheck (whole project)" -ForegroundColor Cyan
pnpm typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "    typecheck FAILED" -ForegroundColor Red
    exit 1
}
Write-Host "    OK" -ForegroundColor Green

Write-Host ""
Write-Host "==> 3. Vitest on the new test file only" -ForegroundColor Cyan
pnpm vitest run __tests__/integrations-http.test.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "    tests FAILED" -ForegroundColor Red
    exit 1
}
Write-Host "    OK" -ForegroundColor Green

Write-Host ""
Write-Host "==> 4. Stage + suggested commit (review before running)" -ForegroundColor Cyan
Write-Host @"
   To commit on a fresh branch off main:
     git checkout main
     git pull origin main
     git checkout -b feat/integration-http-wrapper
     git add src/lib/integrations/http.ts __tests__/integrations-http.test.ts
     git commit -m 'feat(integrations): shared integrationFetch wrapper (phase 1)

   - New: src/lib/integrations/http.ts — timeout, exponential-backoff retry on
     429+5xx, typed IntegrationError, Sentry breadcrumb per call, passthrough
     mode for callers that handle 4xx themselves (e.g. EspoCRM 409 upsert).
   - New: __tests__/integrations-http.test.ts — covers happy path, 5xx retry,
     429 with and without Retry-After, 4xx no-retry, passthrough, 204, text
     content-type, max-retry exhaustion, network errors.

   Phase 1 of the Integration Improvement Plan. Phase 2 migrates existing
   clients (notion.ts, hubspot*, sentry.ts, gsc.ts, slack*) onto this
   wrapper in separate PRs to keep diffs reviewable.'

     git push -u origin feat/integration-http-wrapper
     gh pr create --base main --head feat/integration-http-wrapper ``
       --title 'feat(integrations): shared integrationFetch wrapper (phase 1)' ``
       --body 'See Integration Improvement Plan KB: https://www.notion.so/3687d82c410a8105a52ae5f861632da7'
"@ -ForegroundColor Gray
