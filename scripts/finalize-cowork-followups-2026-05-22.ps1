# Follow-up finalization script for the 2026-05-22 Cowork session.
#
# Runs after finalize-cowork-2026-05-22.ps1. Addresses the recommended next
# steps that couldn't be completed from the sandbox:
#
#   - Restore .env.example if a partial-flush re-truncated it
#   - Stage and commit scripts/finalize-cowork-2026-05-22.ps1 +
#     scripts/post-deploy-esp32-verify.ps1 + this script + the PR body
#   - Show what to run for SSM/Cloudflare/push
#
# Usage:
#   pwsh -File scripts/finalize-cowork-followups-2026-05-22.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path "D:\cloudless.gr"

Write-Host "==> 1. Heal .env.example if it was truncated" -ForegroundColor Cyan
git diff --quiet -- .env.example
if ($LASTEXITCODE -ne 0) {
    Write-Host "    .env.example differs from HEAD — restoring." -ForegroundColor Yellow
    git checkout HEAD -- .env.example
    Write-Host "    restored." -ForegroundColor Green
} else {
    Write-Host "    .env.example matches HEAD — nothing to heal."
}

Write-Host ""
Write-Host "==> 2. Stage the helper scripts + PR body" -ForegroundColor Cyan
$paths = @(
    "scripts/finalize-cowork-2026-05-22.ps1",
    "scripts/finalize-cowork-followups-2026-05-22.ps1",
    "scripts/post-deploy-esp32-verify.ps1",
    "docs/pull-requests/2026-05-22-esp32-notion-mirror.md"
)
foreach ($p in $paths) {
    if (Test-Path $p) {
        git add $p
        Write-Host "    + $p"
    } else {
        Write-Host "    skip (missing): $p" -ForegroundColor Yellow
    }
}

git status -s

Write-Host ""
Write-Host "==> 3. Commit the helper bundle" -ForegroundColor Cyan
$msg = @"
chore(scripts): add Cowork session helpers + ESP32 verify + PR body

- scripts/finalize-cowork-2026-05-22.ps1: idempotent session finalizer
  (typecheck, stage, commit the ESP32 slice)
- scripts/finalize-cowork-followups-2026-05-22.ps1: this script — stages
  the helpers themselves and heals .env.example if a partial flush
  truncated it again
- scripts/post-deploy-esp32-verify.ps1: hits /api/admin/esp32/notion-sync
  (GET + POST) against a live origin with your admin JWT to confirm the
  mirror round-trips
- docs/pull-requests/2026-05-22-esp32-notion-mirror.md: PR body for the
  feature branch
"@
git commit -m $msg
if ($LASTEXITCODE -ne 0) {
    Write-Host "    commit FAILED" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==> 4. Show the commit" -ForegroundColor Cyan
git log -1 --stat

Write-Host ""
Write-Host "==> 5. What to do next" -ForegroundColor Cyan
Write-Host @"

   # Push the branch:
   git push origin fix/malformed-mcp-json

   # Open a PR (with gh CLI):
   gh pr create --base main --head fix/malformed-mcp-json ``
     --title "feat(esp32): Notion devices mirror + sync API" ``
     --body-file docs/pull-requests/2026-05-22-esp32-notion-mirror.md

   # SSM (after merge, before relying on the mirror):
   aws ssm put-parameter --region us-east-1 --type String --overwrite ``
     --name /cloudless/production/NOTION_ESP32_DEVICES_DB_ID --value '<id-from-notion>'
   # optional:
   aws ssm put-parameter --region us-east-1 --type String --overwrite ``
     --name /cloudless/production/NOTION_ESP32_TELEMETRY_DB_ID --value '<id>'
   # only if you set up the Cloudflare Tunnel below:
   aws ssm put-parameter --region us-east-1 --type String --overwrite ``
     --name /cloudless/production/NEXT_PUBLIC_ALERT_WS_URL ``
     --value 'wss://logs.cloudless.online/ws/esp32-logs'

   # Cloudflare Tunnel (one of):
   # a) Via the existing cloudflared on the Pi cluster — add to cloudflared
   #    config.yml:
   #      ingress:
   #        - hostname: logs.cloudless.online
   #          service: http://192.168.1.128:30800
   #        - service: http_status:404
   #    then: cloudflared tunnel route dns <tunnel-name> logs.cloudless.online
   # b) Or via the Cloudflare dashboard: Zero Trust → Networks → Tunnels →
   #    pick the same tunnel that serves manage.cloudless.online → Public
   #    Hostnames → Add → logs.cloudless.online → http://192.168.1.128:30800

   # Post-deploy verification (after merge to main + k3s rollout):
   pwsh -File scripts/post-deploy-esp32-verify.ps1 ``
     -Origin https://cloudless.online ``
     -IdToken (read from your browser admin session)

"@ -ForegroundColor Gray
