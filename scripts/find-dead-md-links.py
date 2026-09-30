#!/usr/bin/env python3
"""Find dead references (weekly-subscriber / hubspot.ts) across
key markdown files."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FILES = [
    "CLAUDE.md", "docs/HUBSPOT.md", "docs/NEWSLETTER.md",
    "docs/runners.md", "docs/AGENCY-HUB.md",
    "docs/ROADMAP-ONE-STOP-SHOP.md",
    "infrastructure/espocrm/README.md",
    "skills/espocrm-operator/SKILL.md",
]

pat = re.compile(r"weekly-subscriber|hubspot\.ts")
for rel in FILES:
    f = ROOT / rel
    if not f.is_file():
        continue
    print(f"=== {rel} ===")
    hits = 0
    for i, ln in enumerate(f.read_text().splitlines(), 1):
        if pat.search(ln):
            print(f"{i}:{ln}")
            hits += 1
            if hits >= 5:
                break
