#!/usr/bin/env python3
"""Wait for a usable tailnet path to a peer before a workflow touches it.

Why: tailscale/github-action reports "connected" as soon as tailscaled
is up, but (a) new ephemeral nodes take a while to propagate through the
tailnet — peers reject traffic until then — and (b) a known action bug
can leave the runner with missing tailscale0 routes, where
`tailscale ping` works but TCP to the peer times out forever
(tailscale/github-action#266).

TCP-probes each requested port with retries; if probes fail it remediates
once with `tailscale down && tailscale up`, then probes again. Fails only
if a port stays unreachable.

Usage: tailscale-wait.py <peer-ip> [tcp-port ...]"""

import socket
import subprocess
import sys
import time

if len(sys.argv) < 2:
    sys.exit("peer ip required")
PEER = sys.argv[1]
PORTS = [int(p) for p in sys.argv[2:]]


def probe_ports() -> bool:
    failed = False
    for port in PORTS:
        for i in range(1, 13):
            try:
                with socket.create_connection((PEER, port), timeout=5):
                    print(f"ok: {PEER}:{port} reachable (attempt {i})")
                    break
            except OSError:
                print(f"tcp {PEER}:{port} attempt {i}/12 failed — "
                      "retrying in 10s")
                if i == 12:
                    failed = True
                else:
                    time.sleep(10)
    return not failed


def tailscale(*args: str, sudo: bool = False) -> int:
    cmd = (["sudo"] if sudo else []) + ["tailscale", *args]
    return subprocess.call(cmd)


print(f"::group::Wait for tailnet path to {PEER}")

# Warm the path regardless — forces DERP->direct negotiation up front.
r = subprocess.run(["tailscale", "ping", "--c", "3", "--timeout", "10s",
                    PEER], capture_output=True, text=True)
print("\n".join((r.stdout + r.stderr).splitlines()[-3:]))
if r.returncode:
    print(f"::warning::tailscale ping to {PEER} failed — TCP probes are "
          "authoritative")

if not probe_ports():
    print("::warning::TCP probes failing — re-syncing tailscale routes "
          "(down/up)")
    subprocess.call(["sudo", "tailscale", "down"])
    subprocess.call(["sudo", "tailscale", "up"])
    time.sleep(5)
    subprocess.call(["tailscale", "ping", "--c", "3", "--timeout",
                     "10s", PEER])
    if not probe_ports():
        print(f"::error::{PEER} still unreachable after tailscale "
              "re-sync")
        print("--- self ---")
        subprocess.call(["tailscale", "status", "--self",
                         "--peers=false"])
        print("--- peer ---")
        r = subprocess.run(["tailscale", "whois", PEER],
                           capture_output=True, text=True)
        for line in (r.stdout + r.stderr).splitlines():
            if any(k in line.lower() for k in
                   ("tags:", "name:", "machine")):
                print(line)
        subprocess.call(["tailscale", "status"])
        subprocess.call(["tailscale", "netcheck"])
        print("::endgroup::")
        sys.exit(1)

print("::endgroup::")
