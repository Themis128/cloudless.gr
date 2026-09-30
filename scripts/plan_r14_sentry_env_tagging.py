#!/usr/bin/env python3
"""R14 Sentry environment tagging plan — prints the goal, current
Sentry/environment usage, and implementation reminders."""

import re
from pathlib import Path

os_root = Path.home() / "code/cloudless.gr"
import os
if os_root.is_dir():
    os.chdir(os_root)

print("""=== R14 Sentry environment tagging plan ===

Goal:
- AWS Lambda / production build reports SENTRY_ENVIRONMENT=prod
- Pi standby build reports SENTRY_ENVIRONMENT=pi-standby

Search current Sentry/environment usage:""")

rx = re.compile(r"SENTRY_ENVIRONMENT|SENTRY_DSN|sentry"
                r"|environment")
skip_dirs = {".venv", "node_modules", ".git", ".next"}
roots = ["src", "app", "infrastructure", "stacks",
         "sst.config.ts", "sst.config.mjs", "next.config.ts",
         "next.config.mjs", "package.json", ".github"]

for root in roots:
    p = Path(root)
    if not p.exists():
        continue
    files = [p] if p.is_file() else [
        f for f in p.rglob("*")
        if f.is_file()
        and not any(d in f.parts for d in skip_dirs)]
    for f in files:
        try:
            for i, line in enumerate(
                    f.read_text(errors="replace").splitlines(),
                    1):
                if rx.search(line):
                    print(f"{f}:{i}:{line}")
        except Exception:
            continue

print("""
Implementation reminder:
- Prefer explicit env injection per deploy target.
- Do not hard-code secrets.
- Keep SENTRY_DSN separate from SENTRY_ENVIRONMENT.
- Verify both surfaces produce distinct environments in Sentry.""")
