#!/usr/bin/env python3
"""Run the deep Playwright suite in small chunks so the dev server
stays healthy.

Usage:
  python3 scripts/e2e-chunked.py api
  python3 scripts/e2e-chunked.py all
  python3 scripts/e2e-chunked.py list"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

os.chdir(Path(__file__).resolve().parent.parent)

CHUNKS = {
    "api": [
        "e2e/deep/public-api-contracts.spec.ts",
        "e2e/deep/health-routing.spec.ts",
        "e2e/deep/security.spec.ts",
    ],
    "pages": ["e2e/deep/i18n-nav.spec.ts", "e2e/deep/cms-campaigns.spec.ts"],
    "auth": ["e2e/deep/auth-lifecycle.spec.ts", "e2e/deep/protected-routes.spec.ts"],
    "journey": ["e2e/deep/store-cart-checkout.spec.ts", "e2e/deep/contact-subscribe.spec.ts"],
    "admin": ["e2e/deep/admin-surface.spec.ts"],
    "ui": ["e2e/deep/a11y.spec.ts"],
}
ORDER = ["api", "pages", "auth", "journey", "admin", "ui"]


def list_chunks() -> None:
    print("Available chunks:")
    for name in ORDER:
        print(f"  {name:<10} {len(CHUNKS[name])} files")


def run_chunk(name: str) -> None:
    files = CHUNKS.get(name)
    if not files:
        print(f"✗ Unknown chunk: {name}")
        list_chunks()
        sys.exit(1)
    print(f"==> Running chunk [{name}] — {len(files)} files (workers=2)")
    shutil.rmtree("test-results", ignore_errors=True)
    r = subprocess.call(
        [
            "pnpm",
            "exec",
            "playwright",
            "test",
            *files,
            "--project=chromium",
            "--workers=2",
            "--reporter=line",
        ]
    )
    if r != 0:
        sys.exit(r)
    print(f"✅ Chunk [{name}] passed")


mode = sys.argv[1] if len(sys.argv) > 1 else "list"
if mode == "list":
    list_chunks()
elif mode == "all":
    print("==> Running all deep chunks sequentially...")
    for name in ORDER:
        run_chunk(name)
    print("All chunks passed.")
else:
    run_chunk(mode)
