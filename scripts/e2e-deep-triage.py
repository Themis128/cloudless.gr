#!/usr/bin/env python3
"""Re-run the fragile e2e/deep specs (auth, i18n/mobile nav, cart,
a11y, contact). Playwright starts its own server on 4010
(.next-e2e) — do not reuse :4000.

Usage: python3 scripts/e2e-deep-triage.py"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", os.path.expanduser("~/.cache/ms-playwright"))

print("==> instrumentation Edge doctor")
doctor = ROOT / "scripts/instrumentation-edge-doctor.mjs"
r = subprocess.run(["node", str(doctor)])

print("==> Playwright deep triage (workers=2)")
r = subprocess.run(
    [
        "pnpm",
        "exec",
        "playwright",
        "test",
        "--workers=2",
        "--reporter=line",
        "e2e/deep/auth-lifecycle.spec.ts",
        "e2e/deep/i18n-nav.spec.ts",
        "e2e/deep/store-cart-checkout.spec.ts",
        "e2e/deep/mobile-chrome.spec.ts",
        "e2e/deep/a11y.spec.ts",
        "e2e/deep/contact-subscribe.spec.ts",
    ]
)
sys.exit(r.returncode)
