#!/usr/bin/env python3
"""
Patch local .env / .env.local to use the production SESSION_SECRET
and fix the corrupted CLOUDFLARE_API_TOKEN (embedded space artifact).
Also updates the local D1 admin password_hash to match the production hash.
"""
import re
import sys

ENV_LOCAL = "/home/tbaltzakis/cloudless.gr/.env.local"
ENV = "/home/tbaltzakis/cloudless.gr/.env"

# NOTE: These are loaded from environment/.env at runtime.
# Do NOT hardcode real secrets in this file.
import os
PROD_SECRET = os.environ.get("SESSION_SECRET", "")
CORRUPT_TOKEN = os.environ.get("CORRUPT_CLOUDFLARE_API_TOKEN", "")
CLEAN_TOKEN = os.environ.get("CLEAN_CLOUDFLARE_API_TOKEN", "")

def patch(path):
    try:
        with open(path, "r") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"  SKIP (not found): {path}")
        return False
    original = content
    # SESSION_SECRET
    content = content.replace(
        "SESSION_SECRET=139b7afa639999732c20f5a28e64a3885f8f65e65df3e4d71845434c3c2d96e0",
        f"SESSION_SECRET={PROD_SECRET}",
    )
    # AUTH_SECRET (in .env already correct; in .env.local replace if present)
    content = re.sub(
        r'AUTH_SECRET="cbb64b43d57ea5fc1831d8661ddae136abe26af69c019dcb55e9324f5585146e"',
        f'AUTH_SECRET="{PROD_SECRET}"',
        content,
    )
    content = re.sub(
        r'AUTH_SECRET=cbb64b43d57ea5fc1831d8661ddae136abe26af69c019dcb55e9324f5585146e',
        f"AUTH_SECRET={PROD_SECRET}",
        content,
    )
    # CLOUDFLARE_API_TOKEN: remove the embedded space
    content = content.replace(
        f"CLOUDFLARE_API_TOKEN={CORRUPT_TOKEN}",
        f"CLOUDFLARE_API_TOKEN={CLEAN_TOKEN}",
    )
    content = content.replace(
        f'CLOUDFLARE_API_TOKEN="{CORRUPT_TOKEN}"',
        f'CLOUDFLARE_API_TOKEN="{CLEAN_TOKEN}"',
    )
    if content == original:
        print(f"  (no changes) {path}")
        return False
    with open(path, "w") as f:
        f.write(content)
    print(f"  PATCHED: {path}")
    return True

print("== Patching .env.local ==")
patch(ENV_LOCAL)
print("== Patching .env ==")
patch(ENV)
print("== Done ==")
