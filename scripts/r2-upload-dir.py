#!/usr/bin/env python3
"""Upload all files from ./out to the cloudless-assets R2 bucket
(remote)."""

import subprocess
import sys
from pathlib import Path

BUCKET = "cloudless-assets"
OUT_DIR = Path("./out")

if not OUT_DIR.is_dir():
    sys.exit(f"Error: {OUT_DIR} directory not found. Run 'pnpm cf:build' first.")

print(f"Uploading files from {OUT_DIR} to R2 bucket: {BUCKET} (remote)")

for f in sorted(OUT_DIR.rglob("*")):
    if not f.is_file():
        continue
    rel = str(f.relative_to(OUT_DIR))
    if rel.startswith("."):
        continue
    print(f"Uploading: {rel}")
    subprocess.run(
        ["npx", "wrangler", "r2", "object", "put", f"{BUCKET}/{rel}", f"--file={f}", "--remote"],
        capture_output=True,
    )

print(f"Done uploading to {BUCKET} (remote)")
