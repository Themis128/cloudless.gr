#!/usr/bin/env python3
"""Wrapper that loads .env.e2e and runs Playwright.
When COVERAGE=1, also starts the Next dev server with
NODE_V8_COVERAGE so server-side V8 coverage is captured."""

import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = REPO_ROOT / ".env.e2e"

if ENV_FILE.is_file():
    for line in ENV_FILE.read_text().splitlines():
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if m:
            os.environ.setdefault(m.group(1),
                                  m.group(2).strip('"\''))
    print(f"\033[1;36m[e2e]\033[0m Loaded {ENV_FILE}")

enabled = []
if os.environ.get("E2E_USER_EMAIL") and \
        os.environ.get("E2E_USER_PASSWORD"):
    enabled.append("user")
if os.environ.get("E2E_ADMIN_EMAIL") and \
        os.environ.get("E2E_ADMIN_PASSWORD"):
    enabled.append("admin")
if os.environ.get("CRON_SECRET"):
    enabled.append("cron")
if os.environ.get("COVERAGE"):
    enabled.append("coverage")
if enabled:
    print(f"\033[1;32m[e2e]\033[0m Enabled: {' '.join(enabled)}")
else:
    print("\033[1;33m[e2e]\033[0m Enabled: (none) — only "
          "public/unauth tests will run")

os.chdir(REPO_ROOT)

# Pin browsers outside the rotating Cursor sandbox cache.
os.environ.setdefault(
    "PLAYWRIGHT_BROWSERS_PATH",
    os.path.expanduser("~/.cache/ms-playwright"))

# Optional user-local Chromium sysroot (when apt install-deps
# needs sudo).
sysroot = Path(os.environ.get(
    "PW_SYSROOT", os.path.expanduser("~/.local/pw-sysroot")))
if (sysroot / "usr/lib/x86_64-linux-gnu").is_dir():
    lib = (f"{sysroot}/usr/lib/x86_64-linux-gnu:"
           f"{sysroot}/lib/x86_64-linux-gnu")
    os.environ["LD_LIBRARY_PATH"] = (
        lib + ":" + os.environ["LD_LIBRARY_PATH"]
        if os.environ.get("LD_LIBRARY_PATH") else lib)
    print(f"\033[1;36m[e2e]\033[0m Using Chromium sysroot "
          f"{sysroot}")


def pid_on_port(port: int) -> str:
    r = subprocess.run(["lsof", "-ti", f":{port}"],
                       capture_output=True, text=True)
    return r.stdout.split()[0] if r.stdout.split() else ""


if os.environ.get("COVERAGE") == "1":
    covdir = REPO_ROOT / ".coverage-v8-server"
    covdir.mkdir(exist_ok=True)
    for f in covdir.glob("*.json"):
        f.unlink()

    pid = pid_on_port(4000)
    if pid:
        try:
            env_raw = Path(f"/proc/{pid}/environ").read_bytes()
            if b"NODE_V8_COVERAGE=" in env_raw:
                print("\033[1;32m[e2e]\033[0m Existing dev server "
                      "already has NODE_V8_COVERAGE — reusing")
            else:
                print("\033[1;33m[e2e]\033[0m Killing existing dev "
                      "server (no NODE_V8_COVERAGE)")
                os.kill(int(pid), 9)
                time.sleep(2)
        except OSError:
            pass

    if not pid_on_port(4000):
        print(f"\033[1;36m[e2e]\033[0m Starting Next dev with "
              f"NODE_V8_COVERAGE={covdir}")
        (REPO_ROOT / ".coverage-run").mkdir(exist_ok=True)
        log = open(REPO_ROOT / ".coverage-run/dev.log", "a")
        env = {**os.environ, "NODE_V8_COVERAGE": str(covdir),
               "NEXT_PUBLIC_E2E": "1"}
        subprocess.Popen(
            ["npx", "next", "dev", "-p", "4000", "--webpack"],
            stdin=subprocess.DEVNULL, stdout=log,
            stderr=subprocess.STDOUT, env=env,
            start_new_session=True)
        for i in range(60):
            try:
                urllib.request.urlopen("http://localhost:4000",
                                       timeout=2)
                print(f"\033[1;32m[e2e]\033[0m Dev server up after "
                      f"{(i + 1) * 2}s")
                break
            except Exception:
                time.sleep(2)

os.execvp("npx", ["npx", "playwright", "test", *sys.argv[1:]])
