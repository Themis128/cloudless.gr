#!/usr/bin/env python3
"""Run E2E tests with safe defaults — avoids the dev-server-OOM
cascade.

Usage:
  python3 scripts/e2e-smart-run.py smoke   # ~30s
  python3 scripts/e2e-smart-run.py full    # all tests, workers=2
  python3 scripts/e2e-smart-run.py k3s     # against live cluster
  python3 scripts/e2e-smart-run.py prod    # against cloudless.gr"""

import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

os.chdir(ROOT)

MODE = sys.argv[1] if len(sys.argv) > 1 else "smoke"


def get(url: str, timeout: int = 10) -> str:
    try:
        return str(urllib.request.urlopen(url, timeout=timeout).status)
    except Exception:
        return ""


def pw(*args: str) -> int:
    return subprocess.call(["pnpm", "exec", "playwright", "test", *args])


if MODE == "smoke":
    print("==> Warming dev server...")
    get("http://localhost:4000/en")
    get("http://localhost:4000/api/health", 5)
    print("==> Running smoke set (health + auth + i18n)...")
    sys.exit(
        pw(
            "e2e/deep/health-routing.spec.ts",
            "e2e/deep/auth-lifecycle.spec.ts",
            "e2e/deep/i18n-nav.spec.ts",
            "e2e/deep/security.spec.ts",
            "--project=chromium",
            "--workers=2",
            "--reporter=line",
        )
    )

elif MODE == "full":
    print("==> Verifying dev server is healthy...")
    code = get("http://localhost:4000/api/health", 5)
    if code != "200":
        sys.exit(
            f"✗ Dev server returns {code or 'no response'} on "
            "/api/health. Run pnpm dev (auto-heals) or "
            "pnpm dev:restart:clean."
        )
    print("==> Warming up routes...")
    for r in ("/en", "/en/services", "/en/contact", "/en/blog", "/api/health", "/api/auth/session"):
        get(f"http://localhost:4000{r}")
    print("==> Running full suite (workers=2 to avoid Turbopack overload)...")
    sys.exit(pw("--project=chromium", "--workers=2", "--reporter=line"))

elif MODE == "k3s":
    print("==> Running k3s standby E2E (live Pi cluster)...")
    sys.exit(pw("--config=playwright.k3s.config.mts", "--reporter=line"))

elif MODE == "k3s-smoke":
    print("==> Running k3s smoke (just the basics)...")
    sys.exit(pw("--config=playwright.k3s.config.mts", "e2e/k3s/smoke.spec.ts", "--reporter=line"))

elif MODE == "prod":
    print("==> Running production smoke (cloudless.gr)...")
    sys.exit(pw("--config=playwright.production.config.mts", "--reporter=line"))

elif MODE == "deep-triage":
    triage = ROOT / "scripts/e2e-deep-triage.py"
    if triage.exists():
        sys.exit(subprocess.call([sys.executable, str(triage)]))
    sys.exit(subprocess.call([sys.executable, "scripts/e2e-deep-triage.py"]))

else:
    sys.exit(f"Usage: {sys.argv[0]} {{smoke|full|k3s|k3s-smoke|prod|deep-triage}}")
