#!/usr/bin/env python3
"""Print the URLs to access the dev server from Windows — run when
'localhost:4000' doesn't work from a Windows browser."""

import re
import subprocess
from pathlib import Path

r = subprocess.run(["ip", "-4", "addr", "show", "eth0"], capture_output=True, text=True)
m = re.search(r"inet (\d+\.\d+\.\d+\.\d+)", r.stdout)
wsl_ip = m.group(1) if m else ""

try:
    wsl_r = subprocess.run(
        ["/mnt/c/Windows/System32/wsl.exe", "-l", "--running"], capture_output=True
    )
    out = wsl_r.stdout.decode("utf-16-le", errors="replace") + wsl_r.stdout.decode(
        "utf-8", errors="replace"
    )
    distro = next(
        (ln.split()[0] for ln in out.splitlines() if "ubuntu" in ln.lower()), "Ubuntu-24.04"
    )
except Exception:
    distro = "Ubuntu-24.04"

config_path = Path("/mnt/c/Users/baltz/.wslconfig")

print(f"""=== WSL Networking Info ===
Distro:   {distro}
WSL IP:   {wsl_ip}

=== Dev URLs to try in your Windows browser ===
  http://localhost:4000        (works with mirrored mode)
  http://{wsl_ip}:4000        (always works — direct WSL IP)
""")

if config_path.is_file():
    if "networkingMode=mirrored" in config_path.read_text():
        print("✓ .wslconfig has mirrored mode enabled.")
        if wsl_ip.startswith("172."):
            print("✗ But you're still on 172.x — WSL hasn't been restarted yet.\n")
            print("To activate mirrored mode, run this in Windows PowerShell (as Admin):")
            print("  wsl --shutdown")
            print("Then reopen your WSL terminal and run 'pnpm dev' again.")
        else:
            print("✓ Mirrored mode is active — localhost:4000 should just work.")
    else:
        print("ℹ .wslconfig does not have mirrored mode.")
        print(f"  http://{wsl_ip}:4000 is the way to go.")
else:
    print(f"ℹ No .wslconfig found at {config_path}")
