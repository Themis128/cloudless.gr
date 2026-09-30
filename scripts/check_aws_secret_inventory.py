#!/usr/bin/env python3
"""AWS secret inventory check — metadata only; secret values are
never printed (only lengths)."""

import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _check import Check

c = Check()
print("== AWS secret inventory check ==")
print("Mode: metadata only; secret values are not printed\n")

if not shutil.which("aws"):
    c.missing("aws CLI is not installed")
    sys.exit(1)


def aws(*args: str) -> str:
    r = subprocess.run(["aws", *args], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


identity = aws("sts", "get-caller-identity", "--query", "Arn", "--output", "text")
if not identity:
    c.missing("AWS identity unavailable")
    sys.exit(1)
c.passed(f"AWS identity available: {identity}")

known_params = [
    "/cloudless/production/CLOUDFLARE_API_TOKEN",
    "/cloudless/production/CLOUDFLARE_ZONE_ID",
    "/cloudless/production/CLOUDFLARE_AUTH_RECORD_ID",
    "/cloudless/production/CLOUDFLARE_DDNS_RECORD_ID",
]

print("\nKnown Cloudflare/DDNS SSM parameter checks:")
for name in known_params:
    out = aws("ssm", "get-parameter", "--name", name, "--with-decryption", "--output", "json")
    if out:
        try:
            p = json.loads(out)["Parameter"]
            c.passed(
                f"{p['Name']} exists type={p['Type']} "
                f"version={p['Version']} "
                f"value_length={len(p.get('Value', ''))}"
            )
            continue
        except Exception:
            pass
    c.warning(f"{name} missing")

print("\nCloudflare/DDNS-related SSM candidates:")
out = aws(
    "ssm",
    "describe-parameters",
    "--query",
    "Parameters[?contains(Name, 'cloudflare') || "
    "contains(Name, 'Cloudflare') || contains(Name,"
    " 'CLOUDFLARE') || contains(Name, 'ddns') || "
    "contains(Name, 'DDNS') || contains(Name, 'CF_')]"
    ".[Name]",
    "--output",
    "text",
)
names = sorted(n for n in out.replace("\t", "\n").splitlines() if n.strip())
if names:
    for n in names:
        print(n)
    c.passed("Found Cloudflare/DDNS SSM parameter candidates")
else:
    c.warning("No Cloudflare/DDNS SSM parameter candidates found")

c.finish()
