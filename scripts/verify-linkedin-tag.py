#!/usr/bin/env python3
"""Quick sanity check: does the live cloudless.gr serve a JS chunk that
carries the LinkedIn partner ID 9535068? Run after a deploy."""

from __future__ import annotations

import re
import sys
import urllib.request

BASE = "https://cloudless.gr"
PAGE = "/en/campaigns/shop-online"
PARTNER_ID = "9535068"


def fetch(url: str) -> str:
    # Cloudflare blocks python-urllib's default UA — pretend to be curl/Mozilla.
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) cloudless-verify/1.0",
            "Accept": "*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310
        return r.read().decode("utf-8", errors="replace")


def main() -> int:
    print(f"=== fetching {BASE}{PAGE}")
    html = fetch(BASE + PAGE)
    print(f"  html size: {len(html)} chars")
    if PARTNER_ID in html:
        print("  HIT in raw HTML (unexpected — tag is consent-gated)")
    chunks = sorted(set(re.findall(r"/_next/static/chunks/[a-zA-Z0-9._/-]+\.js", html)))
    print(f"=== scanning {len(chunks)} chunks for '{PARTNER_ID}'")
    hits: list[str] = []
    for c in chunks:
        body = fetch(BASE + c)
        if PARTNER_ID in body:
            hits.append(c)
            print(f"  HIT: {c}")
    print(f"=== result: {len(hits)} chunks contain '{PARTNER_ID}'")
    return 0 if hits else 2


if __name__ == "__main__":
    sys.exit(main())
