# feat(esp32): Notion devices mirror + sync API

Adds an optional Notion-backed mirror for the ESP32 alert-manager device so the admin panel keeps showing useful state even when the Pi cluster is offline.

## What this PR does

- **`src/lib/notion-esp32.ts`** — new module. `Esp32Status` / `Esp32Alert` types, `upsertEsp32DeviceInNotion()`, `appendEsp32TelemetryToNotion()`, `readEsp32DevicesFromNotion()`. Every helper is a clean no-op when `NOTION_ESP32_DEVICES_DB_ID` is not configured, so the feature ships dark by default.
- **`src/app/api/admin/esp32/notion-sync/route.ts`** — new admin API endpoint:
  - `GET` (admin JWT) → returns the latest Notion-cached snapshot. Used as the off-LAN fallback by the admin page.
  - `POST` (admin JWT **or** `X-Cron-Secret`) → pulls the current status from `ALERT_API_URL/api/esp32/status` and upserts into the Notion devices DB. Cron-callable so the mirror stays warm.
- **`.env.example`** — documents the four new keys:
  - `NOTION_ESP32_DEVICES_DB_ID` (required for the mirror)
  - `NOTION_ESP32_TELEMETRY_DB_ID` (optional — telemetry/alert log)
  - `ALERT_API_URL` (server-side address of the Alert API, defaults to LAN)
  - `NEXT_PUBLIC_ALERT_WS_URL` (browser-side WebSocket URL; must be `wss://` in production to satisfy mixed-content rules)
- **`src/app/[locale]/admin/AdminLayoutClient.tsx`** — merge two adjacent `@/i18n/navigation` imports into one. No behavior change.

## Why

Two real problems with the existing ESP32 admin page:

1. **Mixed-content WebSocket.** The page hardcoded `ws://192.168.1.128:30800/ws/esp32-logs` for the live log stream. From `https://cloudless.online` every modern browser refuses the connection and the page loops on retry forever. The hardware panel ALSO looks dead off-LAN because there's no fallback when the Alert API itself is unreachable from the Next.js server (CloudFront → Lambda doesn't peer with the home LAN).
2. **No Notion record.** Device heartbeats and alerts existed only in the Pi-side Alert API. If the cluster goes down, the app has nothing to show.

This PR addresses (2). (1) is documented in the operator runbook and unblocked by the new `NEXT_PUBLIC_ALERT_WS_URL` env var, but the page edits to consume it are deferred to a follow-up (see Deferred section).

## Schema for the Notion DBs

### Devices DB (required)

One row per device. Updated by upsert (key: `Device ID`).

| Property | Type | Notes |
|---|---|---|
| Name | title | Auto: `ESP32 <device_id>` |
| Device ID | rich_text | Lookup key for upsert |
| IP | rich_text | |
| Firmware | rich_text | |
| RSSI | number | dBm |
| Free RAM | number | bytes |
| Uptime | number | seconds |
| Last Heartbeat | date | ISO with time |
| Status | select | Online \| Stale \| Offline |

### Telemetry DB (optional)

Append-only log of significant alert transitions.

| Property | Type | Notes |
|---|---|---|
| Code | title | e.g. `ESP32_LOW_RAM` |
| Severity | select | critical / high / medium / low / info |
| Message | rich_text | Truncated to 2000 chars |
| Status | select | ACTIVE \| RESOLVED |
| First seen | date | |
| Last seen | date | |

## Operator runbook

1. Create the Devices DB (and optionally Telemetry DB) under `☁️ Cloudless` with the schema above. Capture both database IDs.
2. Set SSM parameters under `/cloudless/production/`:
   - `NOTION_ESP32_DEVICES_DB_ID` (required)
   - `NOTION_ESP32_TELEMETRY_DB_ID` (optional)
   - `NEXT_PUBLIC_ALERT_WS_URL=wss://logs.cloudless.online/ws/esp32-logs` (requires the Cloudflare tunnel below)
   - `CRON_SECRET=<random>` (if wiring scheduled syncs)
3. Stand up a Cloudflare Tunnel from `logs.cloudless.online` → the alert-api Service in the k3s cluster (`192.168.1.128:30800`). Use the existing `manage.cloudless.online` tunnel as the template.
4. Wire `cron-invoker.ts` (Lambda) to POST `/api/admin/esp32/notion-sync` every 60 s with `X-Cron-Secret: $CRON_SECRET`.
5. Verify with `scripts/post-deploy-esp32-verify.ps1` (in this PR's sibling commit).

## What this PR explicitly does NOT do

- **Does not modify the ESP32 admin page** to consume `NEXT_PUBLIC_ALERT_WS_URL` or to fall back to the Notion mirror in the UI. Earlier in the session those edits were attempted but lost to a Cowork / Windows-mount partial-flush issue (see KB page `📘 KB — Cowork on Windows mounts: partial-flush file corruption`). They'll land in a follow-up PR. The new endpoint and module are independently useful — cron can call them now.
- **Does not modify cron-invoker.ts.** The endpoint accepts `X-Cron-Secret`, but the cron wiring is left for the operator runbook step.
- **Does not commit the helper scripts** (`finalize-cowork-*.ps1`, `post-deploy-esp32-verify.ps1`). Those are landing in a sibling chore commit.

## Risk / blast radius

- **Server-side**: zero, until SSM is populated. Both helpers short-circuit when `NOTION_ESP32_DEVICES_DB_ID` is unset.
- **Client-side**: zero. No page touches this code yet.
- **CI**: typecheck verified locally (`pnpm typecheck`, exit 0). No other tooling touched.
- **Rollback**: revert this PR; the new endpoint and module disappear. No data migration to undo.

## CI expectations

- `deploy-pi.yml` will fire on merge to `main`:
  - Job 1 (`ubuntu-24.04-arm`): builds `linux/arm64` image → ECR `cloudless-pi-app:<sha>`.
  - Job 2 (`ubuntu-latest` via Tailscale): `kubectl set image deployment/cloudless` in the `cloudless` namespace on the Pi k3s cluster.
- The same container then serves both `cloudless.gr` (Lambda) and `cloudless.online` (k3s).

## Notion documentation

- [🛠️ 2026-05-22 — Session log](https://www.notion.so/3687d82c410a8172866ce06bf3ee1e0f)
- [📘 KB — ESP32 ↔ Notion mirror: design and operator guide](https://www.notion.so/3687d82c410a8126b728f0c31d36c14f)
- [📘 KB — Cowork on Windows mounts: partial-flush file corruption](https://www.notion.so/3687d82c410a8114931bed213e486474)
- [📘 KB — Integration improvement plan](https://www.notion.so/3687d82c410a8105a52ae5f861632da7)
