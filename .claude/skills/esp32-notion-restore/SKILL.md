---
name: esp32-notion-restore
description: Restore the ESP32 hub Notion page from page history after the 2026-06-02 incident wiped its content. Notion's public API does not expose page-history so this is strictly a UI procedure with verification.
when_to_use:
  - CLAUDE.md "Pending One-Time Setup" → "ESP32 page content" is still PARTIAL RESTORE
  - The ESP32 page in Notion shows stub content but a non-trivial revision history exists
  - A new ESP32 incident requires a known-good baseline page restore
---

# ESP32 Notion Page Restore

The ESP32 hub Notion page lost its content on **2026-06-02 at ~15:19 UTC** when the integration was misconfigured. The page itself still exists; only the body content needs restoring.

This is **UI-only**. Notion's public API does **not** expose page history, version listing, or restore endpoints (verified against `developers.notion.com/reference` 2026-06). The only programmatic alternative is to snapshot pages ahead of time — see "Future-proofing" at the bottom.

## Plan tier requirement

Page history retention:

| Plan | History retention |
|---|---|
| Free | None |
| Plus | 30 days |
| Business | 90 days |
| Enterprise | Unlimited |

The incident was 2026-06-02. Restoring **now (2026-06-14, ~12 days later)** requires Plus or higher. Check your plan at `https://www.notion.so/settings` → **Billing**.

## Restore procedure

### 1. Open the page

URL: navigate to the ESP32 hub page (top-level workspace page, named "ESP32 Devices" or similar).

If you don't know the URL, search Notion workspace for "ESP32" and pick the parent page (the one with the Telemetry + Devices databases nested inside).

### 2. Open page history

1. Click the **`•••`** menu in the top-right of the page
2. Select **Page history**
3. The history sidebar opens with a list of revisions (newest first)

### 3. Find the pre-incident revision

Scroll the list until you see a revision dated **before 2026-06-02 15:19 UTC**. The first viable candidate is likely the last revision *that morning* or the last one from 2026-06-01. Notion timestamps are in local time; the right column shows "X days ago" — for the 2026-06-02 incident at ~12 days ago, look for revisions dated 13+ days ago.

Each revision shows:
- Author
- Timestamp
- A preview of what the page looked like at that point

### 4. Verify it's the right revision

Click the revision to preview it in the main canvas. Confirm:
- The expected sections are present (device list, telemetry views, runbook links)
- It is NOT one of the stub-content revisions from after the incident

If the preview is empty, that revision was already post-incident; pick an older one.

### 5. Restore

Click the **Restore** button in the history sidebar header. Notion will:
- Snapshot the current (post-restore) state as a new revision
- Replace the live page content with the chosen revision
- Keep ALL nested databases untouched

The Devices + Telemetry databases are nested inside this page; the restore does NOT modify them. (Which is fine — CLAUDE.md notes those databases are empty and no data exists to restore in them.)

## Verification

After restore:

1. **Page content check** — confirm the device list, telemetry views, and links are present.
2. **Integration access check** — confirm the "Cloudless.gr App" integration is still listed under `•••` → **Connections**. The restore does NOT change connections, but worth a glance.
3. **Production check** — if any code path reads from this page via the Notion API, hit the relevant route and confirm 200, not `object_not_found`:

```bash
# Adjust to the actual route that surfaces ESP32 data
curl -sS "https://cloudless.gr/api/admin/esp32/devices" -H "Cookie: <your-admin-cookie>"
```

## What restoring does NOT fix

- **Database content.** The Devices and Telemetry databases (page-history-tracked separately, and only data records) are **empty** because no data was ever populated there. CLAUDE.md confirms this. No data exists to restore in those.
- **Production deployments.** This is a Notion-side content restore only. No app changes, no deploys.

## Future-proofing — snapshot critical pages

To survive the next incident without losing content, snapshot mission-critical Notion pages via API and store as JSON in S3 (or git).

A simple snapshot script:

```bash
#!/usr/bin/env bash
# Save snapshots of critical Notion pages to S3.
set -euo pipefail

NOTION_TOKEN=$(aws ssm get-parameter \
  --name /cloudless/production/NOTION_API_KEY \
  --with-decryption --region us-east-1 \
  --query 'Parameter.Value' --output text)

# Page IDs to snapshot (extract from CLAUDE.md's documented IDs).
PAGES=(
  "ESP32_PAGE_ID_HERE"
  # Add more as needed
)

DATE=$(date -u +%Y-%m-%d)

for PAGE_ID in "${PAGES[@]}"; do
  curl -sS -H "Authorization: Bearer $NOTION_TOKEN" \
    -H "Notion-Version: 2022-06-28" \
    "https://api.notion.com/v1/blocks/$PAGE_ID/children?page_size=100" \
    > "/tmp/$PAGE_ID-$DATE.json"

  aws s3 cp "/tmp/$PAGE_ID-$DATE.json" \
    "s3://cloudless-backups/notion-snapshots/$PAGE_ID/$DATE.json"
done
```

Wire that into a daily GH Actions cron (use the existing `weekly-newsletter.yml` as a pattern) and you'll always have a 24-hour-fresh backup of every important page, fully restorable via `PATCH /blocks/{id}/children`.

## See also

- CLAUDE.md "Pending One-Time Setup" → "ESP32 page content"
- `calendar-notion-reshare` skill — companion skill for the Calendar DB re-share that also requires UI action
