#!/usr/bin/env python3
"""Render every social card template under cloudless-brand/social/ to PNG.

Port of render-social-cards.sh.
Output lands in cloudless-brand/social-cards/.
Requires chromium (apt install chromium) and a 64-bit Linux.

Usage: python3 BRANDING/scripts/render-social-cards.py
"""

import shutil
import subprocess
import sys
from pathlib import Path

BRANDING_DIR = Path(__file__).resolve().parent.parent
SRC = BRANDING_DIR / "cloudless-brand" / "social"
OUT = BRANDING_DIR / "cloudless-brand" / "social-cards"
OUT.mkdir(parents=True, exist_ok=True)

chrome = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
if not chrome:
    print("Install chromium first: apt-get install -y chromium", file=sys.stderr)
    sys.exit(1)

SIZES = {
    "preview-social-card-linkedin-1200x630.html": "1200,630",
    "preview-social-card-square-1080x1080.html": "1080,1080",
    "preview-linkedin-banner-1584x396.html": "1584,396",
    "preview-linkedin-feed-1200x1200.html": "1200,1200",
    "preview-portrait-1080x1350.html": "1080,1350",
    "preview-story-1080x1920.html": "1080,1920",
    "preview-x-header-1500x500.html": "1500,500",
    "preview-x-instream-1600x900.html": "1600,900",
}

for name, size in SIZES.items():
    src = SRC / name
    if not src.is_file():
        print(f"  ! {name} missing — skipping")
        continue
    out = OUT / f"{src.stem}.png"
    subprocess.run(
        [
            chrome,
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            f"--window-size={size}",
            f"--screenshot={out}",
            "--virtual-time-budget=2000",
            f"file://{src}",
        ],
        capture_output=True,
        check=False,
    )
    print(f"  ✓ {name:<50} → {out.stat().st_size} bytes")

print(f"\nAll cards rendered into {OUT}")
