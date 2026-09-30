#!/usr/bin/env python3
"""Windsor.ai REST API Helper.

Port of windsor-api.sh.
Usage: ./windsor-api.py <command> [args...]

Commands:
  accounts [datasource]     - List connected accounts (default: all)
  fields <connector>        - List available fields for a connector
  options <connector>       - List connector options
  query <connector> <fields> [date_preset] - Query data
  custom-fields             - List custom fields
  connectors                - List all available connectors

Requires: WINDSOR_API_KEY environment variable
Get your API key from: https://onboard.windsor.ai/app/data-preview
"""

import json
import os
import sys
import urllib.request

API_BASE = "https://connectors.windsor.ai"
ONBOARD_BASE = "https://onboard.windsor.ai/api"

WINDSOR_API_KEY = os.environ.get("WINDSOR_API_KEY", "")
if not WINDSOR_API_KEY:
    print("Error: WINDSOR_API_KEY environment variable not set")
    print("Get your API key from: https://onboard.windsor.ai/app/data-preview")
    sys.exit(1)


def fetch(url: str) -> None:
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            body = resp.read().decode("utf-8", "replace")
        try:
            print(json.dumps(json.loads(body), indent=2))
        except json.JSONDecodeError:
            print(body)
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        sys.exit(1)


def usage() -> None:
    print("""Windsor.ai REST API Helper

Usage: ./windsor-api.py <command> [args...]

Commands:
  accounts [datasource]            List connected accounts (default: all)
  fields <connector>               List available fields
  options <connector>               List connector options
  query <connector> <fields> [preset] Query data (default preset: last_7d)
  custom-fields                    List custom fields
  connectors                       List all available connectors

Examples:
  ./windsor-api.py accounts facebook
  ./windsor-api.py fields googleanalytics4
  ./windsor-api.py query linkedin 'campaign,spend,clicks,date' last_30d

Requires: WINDSOR_API_KEY environment variable""")


def arg(i: int, hint: str) -> str:
    if len(sys.argv) <= i:
        print(hint, file=sys.stderr)
        sys.exit(1)
    return sys.argv[i]


command = sys.argv[1] if len(sys.argv) > 1 else "help"

if command == "accounts":
    datasource = sys.argv[2] if len(sys.argv) > 2 else "all"
    fetch(f"{ONBOARD_BASE}/common/ds-accounts?datasource={datasource}&api_key={WINDSOR_API_KEY}")
elif command == "fields":
    connector = arg(2, "Usage: windsor-api.py fields <connector>")
    fetch(f"{API_BASE}/{connector}/fields?api_key={WINDSOR_API_KEY}")
elif command == "options":
    connector = arg(2, "Usage: windsor-api.py options <connector>")
    fetch(f"{API_BASE}/{connector}/options?api_key={WINDSOR_API_KEY}")
elif command == "query":
    connector = arg(2, "Usage: windsor-api.py query <connector> <fields> [date_preset]")
    fields = arg(3, "Usage: windsor-api.py query <connector> <fields> [date_preset]")
    date_preset = sys.argv[4] if len(sys.argv) > 4 else "last_7d"
    fetch(f"{API_BASE}/{connector}?api_key={WINDSOR_API_KEY}&fields={fields}&date_preset={date_preset}&_renderer=json")
elif command == "custom-fields":
    fetch(f"{ONBOARD_BASE}/custom-fields?api_key={WINDSOR_API_KEY}")
elif command == "connectors":
    fetch(f"{API_BASE}/list_connectors")
else:
    usage()
