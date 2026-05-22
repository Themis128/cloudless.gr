# Finalize the 2026-05-22 Cowork session.
#
# Background: Claude (Cowork) prepared a shippable slice while working from
# WSL, but two things prevented the final stage + commit from inside the
# sandbox:
#   1. .git/index.lock is held by Windows with perms the sandbox can't unlock.
#   2. .tsconfig.check.json was created as a scratch file and the sandbox
#      can't delete it either.
#
# This script does the final reconciliation, typecheck, stage, commit, and
# push from the Windows side. Run from a PowerShell prompt in D:\cloudless.gr.
#
# Usage:
#   pwsh -File scripts/finalize-cowork-2026-05-22.ps1
#
# Or interactively, step by step:
#   pwsh
#   .\scripts\finalize-cowork-2026-05-22.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path "D:\cloudless.gr"

Write-Host "==> 1. Remove stale .git/index.lock if present" -ForegroundColor Cyan
if (Test-Path ".git/index.lock") {
    Remove-Item ".git/index.lock" -Force
    Write-Host "    removed .git/index.lock"
} else {
    Write-Host "    no lock file present"
}

Write-Host ""
Write-Host "==> 2. Remove scratch tsconfig created during typecheck" -ForegroundColor Cyan
if (Test-Path ".tsconfig.check.json") {
    Remove-Item ".tsconfig.check.json" -Force
    Write-Host "    removed .tsconfig.check.json"
}

Write-Host ""
Write-Host "==> 3. Sanity check: working tree state before staging" -ForegroundColor Cyan
git status -s

Write-Host ""
Write-Host "==> 4. Full project typecheck (no time limit on Windows)" -ForegroundColor Cyan
pnpm typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "    typecheck FAILED — stopping. Inspect errors and re-run." -ForegroundColor Red
    exit 1
}
Write-Host "    typecheck OK" -ForegroundColor Green

Write-Host ""
Write-Host "==> 5. Stage the shippable slice" -ForegroundColor Cyan
git add `
    "src/app/[locale]/admin/AdminLayoutClient.tsx" `
    "src/app/api/admin/esp32" `
    "src/lib/notion-esp32.ts" `
    ".env.example"

git status -s

Write-Host ""
Write-Host "==> 6. Commit" -ForegroundColor Cyan
$commitMsg = @"
feat(esp32): add Notion devices mirror + sync API; merge i18n imports

- New: src/lib/notion-esp32.ts — Notion devices/telemetry upsert + read,
  with graceful no-op when NOTION_ESP32_DEVICES_DB_ID is unset.
- New: src/app/api/admin/esp32/notion-sync — GET returns Notion-cached
  snapshot for off-LAN fallback; POST pulls /api/esp32/status from the
  Alert API and upserts into Notion. Accepts admin JWT or X-Cron-Secret.
- .env.example: NOTION_ESP32_DEVICES_DB_ID, NOTION_ESP32_TELEMETRY_DB_ID,
  ALERT_API_URL, NEXT_PUBLIC_ALERT_WS_URL.
- AdminLayoutClient.tsx: merge two adjacent @/i18n/navigation imports
  into one. No behavior change.

See Notion KB: ESP32 ↔ Notion mirror (operator runbook + DB schema).
"@
git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) {
    Write-Host "    commit FAILED — inspect and retry." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==> 7. Show the resulting commit" -ForegroundColor Cyan
git log -1 --stat

Write-Host ""
Write-Host "==> 8. Push (uncomment when ready)" -ForegroundColor Cyan
Write-Host "    To push: git push origin fix/malformed-mcp-json"
Write-Host "    Or open a PR from the branch — deploy-pi.yml will fire on merge to main."

# Uncomment the next two lines to push automatically:
# git push origin HEAD
# Write-Host "    pushed" -ForegroundColor Green
