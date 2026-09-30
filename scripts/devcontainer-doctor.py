#!/usr/bin/env python3
"""Dev Containers terminal/engine diagnostics — bash/docker/WSL
defaults, VS Code env-probe startup latency, settings scan."""

import re
import shutil
import statistics
import subprocess
import time
from pathlib import Path


def passed(msg): print(f"[PASS] {msg}")
def warn(msg): print(f"[WARN] {msg}")
def info(msg): print(f"[INFO] {msg}")


info("Running Dev Containers terminal/engine diagnostics")

if shutil.which("bash"):
    passed(f"bash available: {shutil.which('bash')}")
else:
    warn("bash not found in PATH")

if shutil.which("docker"):
    passed(f"docker CLI available: {shutil.which('docker')}")
    if subprocess.call(["docker", "version"],
                       stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL) == 0:
        passed("docker daemon reachable from current shell")
    else:
        warn("docker daemon not reachable; start Docker Desktop "
             "and wait for Engine running")
else:
    warn("docker CLI not found in this distro; enable Docker "
         "Desktop WSL integration")

if shutil.which("wsl.exe"):
    info("WSL distro list:")
    subprocess.run(["wsl.exe", "-l", "-v"])
    r = subprocess.run(["wsl.exe", "--status"], capture_output=True)
    out = r.stdout.decode("utf-16-le", errors="replace") + \
        r.stdout.decode("utf-8", errors="replace")
    m = re.search(r"Default Distribution:\s*(\S+)", out)
    default = m.group(1) if m else ""
    if not default:
        r = subprocess.run(["wsl.exe", "-l", "-v"],
                           capture_output=True)
        out = r.stdout.decode("utf-16-le", errors="replace") + \
            r.stdout.decode("utf-8", errors="replace")
        for ln in out.splitlines():
            if ln.strip().startswith("*"):
                parts = ln.split()
                default = parts[1] if len(parts) > 1 else ""
                break
    if default:
        if default in ("docker-desktop", "docker-desktop-data"):
            warn(f"WSL default distro is {default}; set a real "
                 "Linux distro as default")
            info("Run: wsl.exe --set-default Ubuntu-24.04")
        else:
            passed(f"WSL default distro looks valid: {default}")
    else:
        warn("Could not determine WSL default distro")

# Measure VS Code userEnvProbe-style startup, median of 3.
samples = []
for _ in range(3):
    t0 = time.monotonic()
    subprocess.run(["bash", "-lic", "exit"],
                   env={"VSCODE_RESOLVING_ENVIRONMENT": "1"},
                   stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL)
    samples.append(int((time.monotonic() - t0) * 1000))
median = statistics.median(samples)
info(f"bash -lic probe startup median ms (3 samples): "
     f"{int(median)} {samples}")
if median > 2200:
    warn("Probe startup is high (>2200ms); VS Code userEnvProbe "
         "delays are likely")
    info("Likely cause: heavy ~/.bashrc or ~/.profile init "
         "(nvm/bash_completion/path scripts)")
else:
    passed("Probe startup is within normal range")

settings = Path("/mnt/c/Users/baltz/AppData/Roaming/"
                "Code - Insiders/User/settings.json")
if settings.is_file():
    info("Checking terminal launch-critical VS Code settings")
    pat = re.compile(
        r'"terminal\.integrated\.(defaultProfile\.windows|'
        r'profiles\.windows|inheritEnv|automationProfile\.windows'
        r'|cwd|env\.windows|windowsEnableConpty)"')
    for i, ln in enumerate(settings.read_text().splitlines(), 1):
        if pat.search(ln):
            print(f"  {i}:{ln}")
    passed("settings.json found and scanned")
else:
    warn(f"VS Code user settings not found at expected path: "
         f"{settings}")

info("Diagnostics complete")
