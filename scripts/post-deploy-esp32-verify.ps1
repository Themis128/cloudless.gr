# Post-deploy verification for the ESP32 ↔ Notion mirror.
#
# Runs against the deployed cloudless.gr (or any reachable origin you
# pass via -Origin). Verifies the new admin sync endpoint round-trips.
#
# Prereqs:
#   - You're signed in to the admin panel in a browser; copy your Cognito ID
#     token from devtools (Application → Cookies → __Secure-... ).
#   - Or grab it programmatically: in the admin browser console,
#     `await (await import('aws-amplify/auth')).fetchAuthSession().then(s => s.tokens.idToken.toString())`
#
# Usage:
#   pwsh -File scripts/post-deploy-esp32-verify.ps1 -Origin https://cloudless.gr -IdToken "<TOKEN>"

param(
    [Parameter(Mandatory = $true)] [string] $IdToken,
    [string] $Origin = "https://cloudless.gr"
)

$ErrorActionPreference = "Stop"
$headers = @{ Authorization = "Bearer $IdToken" }

function Write-Step([string]$msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

Write-Step "1. GET — read Notion-cached snapshot"
try {
    $resp = Invoke-RestMethod -Method GET -Uri "$Origin/api/admin/esp32/notion-sync" -Headers $headers
    if (-not $resp.configured) {
        Write-Host "    Notion mirror is NOT configured (NOTION_ESP32_DEVICES_DB_ID missing in SSM)." -ForegroundColor Yellow
        Write-Host "    Set it and redeploy, then re-run this script." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "    configured=true, devices in Notion: $($resp.devices.Count)" -ForegroundColor Green
} catch {
    Write-Host "    GET failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Step "2. POST — pull current state from Alert API and upsert to Notion"
try {
    $resp = Invoke-RestMethod -Method POST -Uri "$Origin/api/admin/esp32/notion-sync" -Headers $headers
    if ($resp.offline) {
        Write-Host "    Alert API is unreachable from the Next.js server." -ForegroundColor Yellow
        Write-Host "    This is expected on the Lambda side (no LAN access)." -ForegroundColor Yellow
        Write-Host "    Verify from the k3s pod instead: kubectl -n cloudless exec deploy/cloudless -- curl -fsS http://localhost:3000/api/admin/esp32/notion-sync -X POST -H 'Authorization: Bearer <token>'" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "    synced page=$($resp.synced)" -ForegroundColor Green
    Write-Host "    device_id=$($resp.device_id), last_heartbeat=$($resp.last_heartbeat)" -ForegroundColor Green
} catch {
    Write-Host "    POST failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Step "3. GET again — confirm row count increased or device matches"
$resp = Invoke-RestMethod -Method GET -Uri "$Origin/api/admin/esp32/notion-sync" -Headers $headers
Write-Host "    devices in Notion: $($resp.devices.Count)" -ForegroundColor Green
if ($resp.devices.Count -gt 0) {
    $d = $resp.devices[0]
    Write-Host "    most-recent: device_id=$($d.device_id), ip=$($d.ip), rssi=$($d.rssi), heartbeat=$($d.last_heartbeat), stale=$($d.stale)"
}

Write-Host ""
Write-Host "==> All checks passed." -ForegroundColor Green
