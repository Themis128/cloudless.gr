#!/usr/bin/env python3
"""Cluster node SSH access check — resolves each node and runs a
non-interactive SSH probe (hostname, IPs, uname, kubectl)."""

import socket
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _check import Check

NODES = ["omv", "omv-ha"]

c = Check()
print("== cluster node SSH access check ==\n")

for node in NODES:
    print(f"-- {node} --")
    try:
        socket.gethostbyname(node)
    except OSError:
        c.missing(f"{node} does not resolve via hosts/DNS")
        print()
        continue
    c.passed(f"{node} resolves")

    r = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8",
         node,
         "hostname; hostname -I; uname -a; "
         "command -v kubectl >/dev/null 2>&1 && "
         "echo kubectl-ok || true"],
        capture_output=True, text=True)
    print(r.stdout + r.stderr, end="")
    if r.returncode == 0:
        c.passed(f"{node} SSH works non-interactively")
    else:
        c.missing(f"{node} SSH failed non-interactively")
    print()

c.finish()
