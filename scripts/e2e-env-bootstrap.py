#!/usr/bin/env python3
"""Bootstrap .env.e2e for the Playwright E2E suite.
- Pulls CRON_SECRET from AWS SSM at /cloudless/production/CRON_SECRET
- Prompts for test user / admin credentials (skippable)
- Writes a gitignored .env.e2e at repo root (mode 600)

Idempotent: re-run any time. Existing values are preserved unless
you overwrite them.

Usage:
  python3 scripts/e2e-env-bootstrap.py             # interactive
  python3 scripts/e2e-env-bootstrap.py --ssm-only  # CRON only
  python3 scripts/e2e-env-bootstrap.py --print     # redacted dump"""

import getpass
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = REPO_ROOT / ".env.e2e"
EXAMPLE_FILE = REPO_ROOT / ".env.e2e.example"

SSM_PREFIX = os.environ.get("SSM_PREFIX", "/cloudless/production")
REGION = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"


def log(*a):
    print("\033[1;36m[e2e-env]\033[0m", *a)


def warn(*a):
    print("\033[1;33m[e2e-env]\033[0m", *a)


def err(*a):
    print("\033[1;31m[e2e-env]\033[0m", *a, file=sys.stderr)


def existing(key: str) -> str:
    if not ENV_FILE.is_file():
        return ""
    for line in ENV_FILE.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1]
    return ""


def upsert(key: str, value: str) -> None:
    ENV_FILE.touch()
    lines = ENV_FILE.read_text().splitlines()
    for i, ln in enumerate(lines):
        if ln.startswith(f"{key}="):
            lines[i] = f"{key}={value}"
            break
    else:
        lines.append(f"{key}={value}")
    ENV_FILE.write_text("\n".join(lines) + "\n")


def prompt(key: str, label: str, hide: bool = False) -> str:
    current = existing(key)
    masked = ""
    if current:
        masked = " [********]" if hide else f" [{current}]"
    fn = getpass.getpass if hide else input
    try:
        val = fn(f"{label}{masked}: ")
    except EOFError:
        val = ""
    return val or current


MODE = "interactive"
for arg in sys.argv[1:]:
    if arg == "--ssm-only":
        MODE = "ssm-only"
    elif arg == "--print":
        MODE = "print"
    elif arg in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)

if not ENV_FILE.is_file() and EXAMPLE_FILE.is_file():
    log(f"Seeding {ENV_FILE} from .env.e2e.example")
    shutil.copy(EXAMPLE_FILE, ENV_FILE)
ENV_FILE.touch(mode=0o600)
os.chmod(ENV_FILE, 0o600)

if MODE == "print":
    log("Resolved .env.e2e values (passwords redacted):")
    for line in ENV_FILE.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if "PASSWORD" in k or "SECRET" in k:
            v = "<redacted>"
        print(f"  {k}={v}")
    sys.exit(0)

log(f"Fetching CRON_SECRET from SSM at {SSM_PREFIX}/CRON_SECRET")
if shutil.which("aws"):
    r = subprocess.run(
        [
            "aws",
            "ssm",
            "get-parameter",
            "--name",
            f"{SSM_PREFIX}/CRON_SECRET",
            "--with-decryption",
            "--region",
            REGION,
            "--query",
            "Parameter.Value",
            "--output",
            "text",
        ],
        capture_output=True,
        text=True,
    )
    val = r.stdout.strip()
    if val and val != "None":
        upsert("CRON_SECRET", val)
        log(f"✓ CRON_SECRET pulled from SSM (len={len(val)})")
    else:
        warn("Could not fetch CRON_SECRET from SSM. Cron happy-path tests will skip.")
        warn("  Possible causes: AWS creds not loaded, parameter missing, wrong region.")
        if not existing("CRON_SECRET"):
            upsert("CRON_SECRET", "")
else:
    warn("aws-cli not found in PATH. Cron happy-path tests will skip.")
    if not existing("CRON_SECRET"):
        upsert("CRON_SECRET", "")

if MODE == "ssm-only":
    log("Done (ssm-only).")
    sys.exit(0)

log("Configuring test user credentials")
log("  (Press Enter to keep existing; leave both blank to skip user-auth tests)")
upsert("E2E_USER_EMAIL", prompt("E2E_USER_EMAIL", "Test user email"))
upsert("E2E_USER_PASSWORD", prompt("E2E_USER_PASSWORD", "Test user password", hide=True))

log("Configuring test admin credentials")
upsert("E2E_ADMIN_EMAIL", prompt("E2E_ADMIN_EMAIL", "Test admin email"))
upsert("E2E_ADMIN_PASSWORD", prompt("E2E_ADMIN_PASSWORD", "Test admin password", hide=True))

if not existing("PLAYWRIGHT_BASE_URL"):
    upsert("PLAYWRIGHT_BASE_URL", "http://localhost:4000")
if not existing("NEXT_PUBLIC_E2E"):
    upsert("NEXT_PUBLIC_E2E", "1")

log("\n✓ Wrote", ENV_FILE)
log("\nNext: pnpm test:e2e:full       # all 1000+ cases")
log("  or: pnpm test:e2e            # quick smoke")
