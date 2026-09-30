#!/usr/bin/env python3
"""configure-pi-firewall.py — SSH-safe host firewall for omv / omv-ha.

Port of configure-pi-firewall.sh.

Goals (per Tailscale docs: classic OpenSSH over the mesh, not Tailscale SSH):
  - Allow SSH from Tailscale CGNAT (100.64.0.0/10) WITHOUT ufw rate-limit
  - Allow SSH from LAN 192.168.1.0/24 without rate-limit
  - Keep public SSH rate-limited (omv) or closed (omv-ha preference)
  - Always allow Tailscale UDP 41641 + established

Run as root on the Pi:
  sudo python3 configure-pi-firewall.py
"""

import os
import re
import shutil
import socket
import subprocess
import sys

if os.geteuid() != 0:
    print("must be root", file=sys.stderr)
    sys.exit(1)

LAN_CIDR = os.environ.get("PI_LAN_CIDR", "192.168.1.0/24")
TS_CGNAT = "100.64.0.0/10"
HOST = socket.gethostname().split(".")[0]


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=False)


print(f"[fw] host={HOST}")

if shutil.which("ufw"):
    print("[fw] configuring ufw")
    run("ufw", "--force", "enable")

    # Specific allows MUST precede any LIMIT Anywhere (ufw first-match wins).
    rule_rx = re.compile(r"cloudless-ssh-ts|cloudless-ssh-lan|cloudless-ssh-public|22/tcp.*LIMIT")
    num_rx = re.compile(r"^\[\s*(\d+)\]")
    while rule_rx.search(run("ufw", "status", "numbered").stdout or ""):
        status = run("ufw", "status", "numbered").stdout or ""
        num = ""
        for line in status.splitlines():
            if rule_rx.search(line):
                m = num_rx.match(line.strip())
                if m:
                    num = m.group(1)
                break
        if not num:
            break
        r = subprocess.run(["ufw", "delete", num], input="y\n", capture_output=True, text=True, check=False)
        if r.returncode != 0:
            break

    run("ufw", "insert", "1", "allow", "from", TS_CGNAT, "to", "any", "port", "22", "proto", "tcp", "comment", "cloudless-ssh-ts")
    run("ufw", "insert", "2", "allow", "from", LAN_CIDR, "to", "any", "port", "22", "proto", "tcp", "comment", "cloudless-ssh-lan")
    run("ufw", "limit", "22/tcp", "comment", "cloudless-ssh-public-limit")

    # Broad Tailscale allow (non-SSH) if missing
    status = run("ufw", "status").stdout or ""
    if "100.64.0.0/10" not in status:
        run("ufw", "allow", "from", TS_CGNAT, "comment", "cloudless-tailscale-net")
    if "41641/udp" not in status:
        run("ufw", "allow", "41641/udp", "comment", "cloudless-tailscale-wireguard")

    # Avoid full reload mid-session when possible — enable is enough if already active
    print((run("ufw", "status", "verbose").stdout or "").rstrip())
else:
    print("[fw] no ufw — installing nftables SSH allow set (omv-ha style)")
    if not shutil.which("nft"):
        print("nft not found", file=sys.stderr)
        sys.exit(1)

    if run("nft", "list", "table", "inet", "cloudless_fw").returncode == 0:
        run("nft", "delete", "table", "inet", "cloudless_fw")

    nft_rules = f"""\
table inet cloudless_fw {{
  chain input {{
    type filter hook input priority -10; policy accept;
    ct state established,related accept
    iifname "lo" accept
    iifname "tailscale0" accept
    udp dport 41641 accept
    tcp dport 22 ip saddr {LAN_CIDR} accept
    tcp dport 22 ip saddr {TS_CGNAT} accept
  }}
}}
"""
    r = subprocess.run(["nft", "-f", "-"], input=nft_rules, capture_output=True, text=True, check=False)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        sys.exit(1)
    print("[fw] nft table inet cloudless_fw installed")
    print((run("nft", "list", "table", "inet", "cloudless_fw").stdout or "").rstrip())

# Tailscale SSH stays off — classic sshd only
if shutil.which("tailscale"):
    run("tailscale", "set", "--ssh=false")

print("[fw] done")
