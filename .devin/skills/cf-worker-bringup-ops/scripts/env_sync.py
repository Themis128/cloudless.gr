#!/usr/bin/env python3
"""Idempotent .env key merge — copies KEY=VALUE pairs from a fragment
file into a target .env (update-or-append). Never prints secret values;
prints only which keys were written.

Usage:
  python env_sync.py <fragment> <target.env>
  python env_sync.py ~/cf-worker-secrets.txt /mnt/c/Users/tbaltzakis/cu130-slim/.env --restart

--restart also runs `docker compose up -d --force-recreate` for
social-api + social-worker-publishing/-media/-default/-messenger in the
target file's directory when docker-compose.yml sits beside it.
(`compose restart` does NOT re-read .env — env changes need a recreate.)
"""

from __future__ import annotations

import os
import subprocess
import sys


def _parse(path: str) -> dict[str, str]:
    out = {}
    for line in open(path, encoding="utf-8"):
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, _, v = s.partition("=")
        out[k.strip()] = v.strip()
    return out


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--restart"]
    restart = "--restart" in sys.argv
    if len(args) != 2:
        print("usage: env_sync.py <fragment> <target.env> [--restart]")
        return 2

    frag, target = args
    new = _parse(frag)
    lines = open(target, encoding="utf-8").read().splitlines() if os.path.exists(target) else []
    seen = set()
    out = []
    for line in lines:
        s = line.strip()
        if s and not s.startswith("#") and "=" in s:
            k = s.split("=", 1)[0].strip()
            if k in new:
                line = f"{k}={new[k]}"
                seen.add(k)
        out.append(line)
    for k, v in new.items():
        if k not in seen:
            out.append(f"{k}={v}")
    open(target, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
    print(f"wrote {len(new)} keys to {target}: {sorted(new)}")

    if restart:
        cwd = os.path.dirname(os.path.abspath(target))
        if os.path.exists(os.path.join(cwd, "docker-compose.yml")):
            services = [
                "social-api",
                "social-worker-publishing",
                "social-worker-media",
                "social-worker-default",
                "social-worker-messenger",
                "celery-beat",
            ]
            try:
                result = subprocess.run(
                    ["docker", "compose", "up", "-d", "--force-recreate", *services],
                    cwd=cwd,
                    timeout=300,
                    capture_output=True,
                    text=True,
                )
            except (OSError, subprocess.TimeoutExpired) as e:
                print(f"recreate failed to run: {e}")
                return 1
            if result.returncode != 0:
                print(f"compose up failed (rc={result.returncode}): {result.stderr.strip()[:300]}")
                return 1
            print("recreated social-api + workers (env reloaded)")
        else:
            print("no docker-compose.yml next to target — restart manually")
    return 0


if __name__ == "__main__":
    sys.exit(main())
