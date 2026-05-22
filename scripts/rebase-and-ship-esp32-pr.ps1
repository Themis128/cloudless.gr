# Rebase the ESP32 work onto current origin/main and ship the PR.
#
# Why this script exists:
#   - fix/malformed-mcp-json was based on c374fe37; main has moved to 44092cc4.
#     Without a rebase, the PR diff appears to touch 46 files (it's mostly
#     other people's commits in the gap).
#   - .env.example was truncated by a sandbox partial-flush. Needs healing.
#   - There's already an origin/claude/fix-esp32-ws-hostname-detection branch
#     that solves the WS mixed-content problem differently. We don't conflict
#     with it (different files), but the operator should know.
#
# What this script does:
#   1. Heal .env.example from HEAD if truncated.
#   2. Rebase fix/malformed-mcp-json onto origin/main.
#   3. Show the resulting diff (should be ~4 files: AdminLayoutClient.tsx
#      + notion-esp32.ts + notion-sync/route.ts + .env.example additions).
#   4. Run pnpm typecheck.
#   5. Push (with --force-with-lease since we rebased).
#   6. Open the PR using the prepared body.
#
# Run with: pwsh -File scripts\rebase-and-ship-esp32-pr.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path "D:\cloudless.gr"

Write-Host "==> 0. Sanity: which branch am I on?" -ForegroundColor Cyan
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "    branch=$branch"
if ($branch -ne "fix/malformed-mcp-json") {
    Write-Host "    refusing to run on a different branch. Checkout fix/malformed-mcp-json first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==> 1. Remove any stale .git/index.lock + scratch tsconfig" -ForegroundColor Cyan
if (Test-Path ".git/index.lock") { Remove-Item ".git/index.lock" -Force; Write-Host "    removed .git/index.lock" }
if (Test-Path ".tsconfig.check.json") { Remove-Item ".tsconfig.check.json" -Force }

Write-Host ""
Write-Host "==> 2. Heal .env.example if truncated by earlier partial-flush" -ForegroundColor Cyan
git diff --quiet -- .env.example
if ($LASTEXITCODE -ne 0) {
    Write-Host "    .env.example differs from HEAD — restoring from HEAD." -ForegroundColor Yellow
    git checkout HEAD -- .env.example
    Write-Host "    restored." -ForegroundColor Green
} else {
    Write-Host "    .env.example matches HEAD — nothing to heal."
}

Write-Host ""
Write-Host "==> 3. git status before rebase" -ForegroundColor Cyan
git status -s

Write-Host ""
Write-Host "==> 4. Fetch latest origin/main" -ForegroundColor Cyan
git fetch origin main

Write-Host ""
Write-Host "==> 5. Rebase onto origin/main" -ForegroundColor Cyan
git rebase origin/main
if ($LASTEXITCODE -ne 0) {
    Write-Host "    rebase had conflicts. Resolve manually, then run:" -ForegroundColor Red
    Write-Host "      git rebase --continue   (or --abort to bail)"
    exit 1
}

Write-Host ""
Write-Host "==> 6. Diff stat after rebase (should be ~4 files)" -ForegroundColor Cyan
git diff --stat origin/main..HEAD

Write-Host ""
Write-Host "==> 7. pnpm typecheck (no time cap on Windows)" -ForegroundColor Cyan
pnpm typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "    typecheck FAILED — stopping." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==> 8. Push (force-with-lease because we rebased)" -ForegroundColor Cyan
git push --force-with-lease origin fix/malformed-mcp-json
if ($LASTEXITCODE -ne 0) {
    Write-Host "    push FAILED. Inspect, then re-run." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==> 9. Note about overlapping branch" -ForegroundColor Cyan
Write-Host @"
   origin/claude/fix-esp32-ws-hostname-detection already exists and solves
   the WS mixed-content problem differently (hostname detection in the page).
   Our work is the durable Notion mirror. The two PRs don't conflict — they
   touch different files. Recommend shipping both.
"@ -ForegroundColor Gray

Write-Host ""
Write-Host "==> 10. Open the PR" -ForegroundColor Cyan
if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh pr create --base main --head fix/malformed-mcp-json `
        --title "feat(esp32): Notion devices mirror + sync API" `
        --body-file docs/pull-requests/2026-05-22-esp32-notion-mirror.md
} else {
    Write-Host "    gh CLI not installed. Open the PR manually with this body:" -ForegroundColor Yellow
    Write-Host "    docs/pull-requests/2026-05-22-esp32-notion-mirror.md"
}

Write-Host ""
Write-Host "==> Done. SSM put-parameter commands are in the Notion KB:" -ForegroundColor Green
Write-Host "    https://www.notion.so/3687d82c410a8126b728f0c31d36c14f"
