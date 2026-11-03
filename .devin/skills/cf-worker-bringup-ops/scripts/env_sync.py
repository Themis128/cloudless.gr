#!/usr/bin/env python3
"""Idempotent .env key merge — copies KEY=VALUE pairs from a fragment
file into a target .env (update-or-append). Never prints secret values;
prints only which keys were written.

Usage:
  python env_sync.py <fragment> <target.env>
  python env_sync.py ~/cf-worker-secrets.txt /mnt/c/Users/tbaltzakis/cu130-slim/.env --restart

--restart also runs `docker compose restart social-api social-worker`
in the target file's directory when docker-compose.yml sits beside it.
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
            subprocess.run(
                ["docker", "compose", "restart", "social-api", "social-worker"],
                cwd=cwd, timeout=120,
            )
            print("restarted social-api + social-worker")
        else:
            print("no docker-compose.yml next to target — restart manually")
    return 0


if __name__ == "__main__":
    sys.exit(main())
