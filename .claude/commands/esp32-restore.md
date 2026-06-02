# /esp32-restore — restore the ESP32/ESPHome Notion page content

Guides restoration of the ESP32 & ESPHome Watchdog Pi Cluster Monitor v2 Notion
page, which had its content overwritten at ~15:19 UTC 2026-06-02.

## Current state

- **Page ID**: `3677d82c-410a-81e4-a6db-e9ae89578fda`
- **Page URL**: https://www.notion.so/ESP32-ESPHome-Watchdog-Pi-Cluster-Monitor-v2-3677d82c410a81e4a6dbe9ae89578fda
- **Status**: Title restored, structure rebuilt (partial) — but full content
  (diagrams, wiring tables, ESPHome YAML examples) is only in Notion page history
- **ESP32 Devices DB**: empty (ID `0df91be4-de4e-4f95-b84e-6f3cce4e1c3e`) — no data
- **ESP32 Telemetry DB**: empty (ID `3be6d7cd-96ac-4fd4-9eb7-0bcc0d65e20b`) — no data

## Steps

### Step 1 — Restore from Notion page history (manual, 2 minutes)

This requires a Notion account with edit access. The databases are empty
(never had data) so only the page content needs restoration.

1. Open the page: https://www.notion.so/ESP32-ESPHome-Watchdog-Pi-Cluster-Monitor-v2-3677d82c410a81e4a6dbe9ae89578fda
2. Click **`···`** (More) in the top-right corner of the page
3. Select **Page history**
4. Find a version **before 15:19 UTC on 2026-06-02** (look for the last version
   with full content — the overwrite happened at that time)
5. Click **Restore** on that version

The page will be restored to its pre-overwrite state with all diagrams, wiring
tables, and ESPHome YAML configuration examples.

### Step 2 — Verify (optional)

After restoring, check that the page shows:
- ESPHome device configurations
- Wiring diagrams / GPIO pin tables
- Integration instructions with the Pi cluster monitor
- Links to related Notion databases

### Step 3 — Populate ESP32 databases (when devices exist)

The two Notion databases are empty because no ESP32 device data was ever
written to them. When ESP32 devices are set up:

- **ESP32 Devices DB** (`0df91be4-de4e-4f95-b84e-6f3cce4e1c3e`): add device entries
- **ESP32 Telemetry DB** (`3be6d7cd-96ac-4fd4-9eb7-0bcc0d65e20b`): telemetry records

These are accessible from the app via `notion-databases.ts` (the IDs are already
wired in SSM `/cloudless/production/NOTION_ESP32_*`).

## Notes

- Page history restore is NOT automatable via the Notion API — it requires
  the Notion UI. This is a Notion platform limitation.
- The `notion-restore-esp32.yml` workflow (now deleted) had already run and
  rebuilt the page structure, but could not restore the pre-overwrite content.
- If you cannot find the right page history version, check versions around
  15:15–15:18 UTC 2026-06-02 (just before the overwrite).
