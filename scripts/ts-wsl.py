#!/usr/bin/env python3
"""Start Tailscale in WSL userspace mode (no sudo / no TUN device).
Exposes SOCKS5 + HTTP proxy on localhost:1055 for apps that must
dial 100.x. Passes args through to `tailscale --socket=…`."""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

BIN = Path.home() / "bin"
STATE = Path.home() / ".local" / "tailscale"
SOCK = STATE / "tailscaled.sock"
SOCKS_ADDR = os.environ.get("TS_SOCKS_ADDR", "localhost:1055")

STATE.mkdir(parents=True, exist_ok=True)
BIN.mkdir(parents=True, exist_ok=True)
os.environ["PATH"] = f"{BIN}:{os.environ['PATH']}"

tailscaled = BIN / "tailscaled"
if not tailscaled.exists() and not shutil.which("tailscaled"):
    sys.exit("tailscaled missing in ~/bin — see "
             "docs/kubectl-tailscale.md")

running = subprocess.run(["pgrep", "-f", str(BIN / "tailscaled")],
                        capture_output=True).returncode == 0
if not running:
    log = open(STATE / "tailscaled.log", "w")
    proc = subprocess.Popen(
        [str(tailscaled), "--tun=userspace-networking",
         f"--socks5-server={SOCKS_ADDR}",
         f"--outbound-http-proxy-listen={SOCKS_ADDR}",
         f"--state={STATE}/tailscaled.state",
         f"--socket={SOCK}", f"--statedir={STATE}"],
        stdout=log, stderr=subprocess.STDOUT,
        start_new_session=True)
    print(f"tailscaled started pid {proc.pid} "
          f"(SOCKS5 {SOCKS_ADDR})")
    time.sleep(2)

os.execvp(str(BIN / "tailscale"),
          [str(BIN / "tailscale"), f"--socket={SOCK}",
           *sys.argv[1:]])
