#!/usr/bin/env python3
"""Submit cloudless.gr URLs to IndexNow (Bing/Copilot/ChatGPT index).

The API key file must exist at https://cloudless.gr/<KEY>.txt containing
exactly the key. The key file lives in public/ so Next serves it at root.

Usage:
    python3 scripts/indexnow-submit.py              # submit all sitemap URLs
    python3 scripts/indexnow-submit.py URL [URL...] # submit specific URLs
    python3 scripts/indexnow-submit.py --dry-run    # print payload, don't POST
"""

import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

HOST = "cloudless.gr"
SITEMAP = f"https://{HOST}/sitemap.xml"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"

# The key is also the key-file basename; keep in sync with public/<KEY>.txt.
KEY = "b5de360b465d44828fee324bf8bd3dc2"
KEY_FILE = Path(__file__).resolve().parent.parent / "public" / f"{KEY}.txt"


def sitemap_urls() -> list[str]:
    req = urllib.request.Request(
        SITEMAP, headers={"User-Agent": "IndexNowSubmit/1.0 (+https://cloudless.gr)"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        root = ET.fromstring(resp.read())
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [loc.text for loc in root.findall(".//sm:loc", ns) if loc.text]


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    urls = [a for a in sys.argv[1:] if not a.startswith("--")] or sitemap_urls()

    if not KEY_FILE.is_file() or KEY_FILE.read_text().strip() != KEY:
        print(f"ERROR: key file missing/mismatched: {KEY_FILE}")
        print("IndexNow requires https://{}/{}.txt to serve the key.".format(HOST, KEY))
        return 1

    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": f"https://{HOST}/{KEY}.txt",
        "urlList": urls[:10000],  # IndexNow per-request cap
    }

    if dry_run:
        print(json.dumps({**payload, "urlList": urls[:5]}, indent=2))
        print(f"... {len(urls)} URLs total (showing 5)")
        return 0

    req = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"IndexNow: {resp.status} — submitted {len(urls)} URLs")
    except urllib.error.HTTPError as e:
        print(f"IndexNow HTTP {e.code}: {e.read().decode()[:300]}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
