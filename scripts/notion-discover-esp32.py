#!/usr/bin/env python3
"""notion-discover-esp32 — find ESP32 databases accessible to the
Notion integration.

The notion-restore-esp32 workflow returned 0 rows because the
integration may not have access to the ESP32 Devices / Telemetry
databases, or the IDs are wrong. Lists all accessible DBs,
searches for ESP32-ish pages, and probes the hardcoded DB IDs."""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _notion import api, title_of


def note(msg: str) -> None:
    print(f"[esp32-discover] {msg}")


note("=== notion-discover-esp32 "
     f"{time.strftime('%F %T', time.gmtime())}Z ===")

note("Querying all accessible databases...")
res = api("POST", "/search",
          {"filter": {"value": "database",
                      "property": "object"},
           "page_size": 100})
dbs = res.get("results", [])
print(f"Total databases accessible: {len(dbs)}")
for r in dbs:
    print(f"  DB: {r.get('id', '')} | {title_of(r)} | "
          f"archived={r.get('archived', False)}")

note("")
note("Searching for ESP32 / devices / telemetry pages...")
for query in ("ESP32", "Devices", "Telemetry", "ESPHome",
              "Watchdog"):
    res = api("POST", "/search",
              {"query": query, "page_size": 10})
    matches = []
    for r in res.get("results", []):
        obj = r.get("object", "")
        title = title_of(r)
        if title or r.get("id"):
            matches.append(
                f"  {obj}: {r.get('id')} | {title} | "
                f"archived={r.get('archived', False)}")
    note(f"Query '{query}': "
         + ("\n" + "\n".join(matches) if matches
            else "no matches"))

note("")
note("Testing hardcoded DB IDs from restore script...")
for db_id in (
        "022b2212-995b-4e29-8c3c-900297b435b9",
        "3214d53d-90ff-4b7a-81c3-f689a92ee167"):
    res = api("POST", f"/databases/{db_id}/query",
              {"page_size": 1})
    if res.get("object") == "list":
        note(f"  DB {db_id}: ACCESSIBLE (returned "
             f"{len(res.get('results', []))} rows)")
    else:
        note(f"  DB {db_id}: NOT accessible "
             f"({res.get('code', 'unknown')}: "
             f"{res.get('message', '')})")

note("")
note("=== DONE ===")
note("If the hardcoded IDs are 'object_not_found': the Notion "
     "integration needs")
note("to be shared with those databases in the Notion UI:")
note("  1. Open ESP32 Devices database in Notion")
note("  2. Click Share → invite the Cloudless Notion "
     "integration")
note("  3. Repeat for ESP32 Telemetry database")
note("  4. Re-run notion-restore-esp32 workflow")
