#!/usr/bin/env python3
"""notion-restore-esp32 — reconstruct the ESP32 ESPHome Watchdog
page accidentally overwritten by notion-update-cluster-docs on
2026-06-02.

Page ID: 3677d82c-410a-81e4-a6db-e9ae89578fda
Original title: ESP32 ESPHome Watchdog — Pi Cluster Monitor (v2)

For a perfect restore: Notion UI → page → ··· → Page history →
restore the version from before 2026-06-02 15:19 UTC."""

import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _notion import (api, bul, callout, divider, h1, h2, p,
                     prop_text)

TARGET_PAGE_ID = "3677d82c-410a-81e4-a6db-e9ae89578fda"
DEVICES_DB_ID = os.environ.get(
    "NOTION_ESP32_DEVICES_DB_ID",
    "022b2212-995b-4e29-8c3c-900297b435b9")
TELEMETRY_DB_ID = os.environ.get(
    "NOTION_ESP32_TELEMETRY_DB_ID",
    "3214d53d-90ff-4b7a-81c3-f689a92ee167")


def note(msg: str) -> None:
    print(f"[esp32-restore] {msg}")


def rows_of(db_id: str, page_size: int = 100,
            sorts: list | None = None) -> list:
    body: dict = {"page_size": page_size}
    if sorts:
        body["sorts"] = sorts
    res = api("POST", f"/databases/{db_id}/query", body)
    rows = []
    for r in res.get("results", []):
        row = {"_created": r.get("created_time", "")}
        for k, v in r.get("properties", {}).items():
            row[k] = prop_text(v)
        rows.append(row)
    return rows


note("=== notion-restore-esp32 "
     f"{time.strftime('%F %T', time.gmtime())}Z ===")
note(f"Target page: {TARGET_PAGE_ID}")

note("Reading ESP32 Devices database...")
devices = rows_of(DEVICES_DB_ID)
note(f"  Devices rows: {len(devices)}")

note("Reading ESP32 Telemetry database (last 10 entries)...")
telemetry = rows_of(
    TELEMETRY_DB_ID, page_size=10,
    sorts=[{"timestamp": "created_time",
            "direction": "descending"}])
note(f"  Telemetry rows fetched: {len(telemetry)}")

note("Restoring page title...")
api("PATCH", f"/pages/{TARGET_PAGE_ID}",
    {"properties": {"title": {"title": [
        {"text": {"content": "ESP32 ESPHome Watchdog — Pi "
                             "Cluster Monitor (v2)"}}]}}})
note("  Title restored")

note("Clearing overwritten blocks...")
existing = api(
    "GET",
    f"/blocks/{TARGET_PAGE_ID}/children?page_size=100")\
    .get("results", [])
for b in existing:
    api("DELETE", f"/blocks/{b['id']}")
note("  Cleared")

note("Rebuilding page content...")
blocks = [
    callout(
        "CONTENT PARTIALLY RESTORED — 2026-06-02: This page "
        "was accidentally overwritten by "
        "notion-update-cluster-docs.yml. The prose "
        "documentation was lost. For the full original "
        "content: open ••• menu → Page history → restore "
        "version before 15:19 UTC on 2026-06-02. The "
        "structured database data below was reconstructed "
        "from the ESP32 Devices and Telemetry databases."),
    divider(),
    h1("ESP32 ESPHome Watchdog — Pi Cluster Monitor (v2)"),
    p("Hardware watchdog for the omv k3s cluster Pi nodes. "
      "Runs ESPHome firmware on ESP32 hardware to monitor "
      "cluster health and trigger physical resets if the Pi "
      "becomes unresponsive."),
    divider(),
    h2("Registered Devices"),
]

NAME_KEYS = ("name", "device", "title")
if devices:
    for d in devices:
        name = next((v for k, v in d.items()
                     if k.lower() in NAME_KEYS and v), None)
        if name:
            details = ", ".join(
                f"{k}: {v}" for k, v in d.items()
                if k not in NAME_KEYS and k != "_created"
                and v)
            blocks.append(bul(
                name + (f" — {details}" if details else "")))
else:
    blocks.append(bul("(No devices found in database — check "
                      "NOTION_ESP32_DEVICES_DB_ID)"))

blocks.append(divider())
blocks.append(h2("Recent Telemetry"))
if telemetry:
    for t in telemetry[:5]:
        created = t.get("_created", "")[:16].replace("T", " ")
        name = next((v for k, v in t.items()
                     if k.lower() in NAME_KEYS and v), "entry")
        details = ", ".join(
            f"{k}: {v}" for k, v in t.items()
            if k not in NAME_KEYS and k != "_created" and v)
        blocks.append(bul(
            f"[{created}] {name}"
            + (f" — {details}" if details else "")))
else:
    blocks.append(bul("(No recent telemetry — check "
                      "NOTION_ESP32_TELEMETRY_DB_ID)"))

blocks += [
    divider(),
    h2("Recovery Note"),
    p("To fully restore this page, use Notion page history:"),
    bul("Open this page in Notion"),
    bul("Click ••• (more menu) in the top right"),
    bul("Click Page history"),
    bul("Find the version from before 2026-06-02 15:19 UTC"),
    bul("Click Restore"),
]

res = api("PATCH",
          f"/blocks/{TARGET_PAGE_ID}/children",
          {"children": blocks[:100]})
note(f"  Append status: {res.get('object', 'error')}")

note("\n=== DONE ===")
note("Restored (partial): https://www.notion.so/"
     "ESP32-ESPHome-Watchdog-Pi-Cluster-Monitor-v2-"
     "3677d82c410a81e4a6dbe9ae89578fda")
note("ACTION REQUIRED: Open page → ••• → Page history → "
     "restore pre-15:19 UTC 2026-06-02 version for full "
     "content")
