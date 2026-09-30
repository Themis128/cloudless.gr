#!/usr/bin/env python3
"""Cloudless BRANDING one-shot installer — stages the BRANDING
scaffold + brand pack from the Claude outputs folder into
~/code/BRANDING and runs its setup.sh. Idempotent."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

SRC = Path(
    "/mnt/c/Users/baltz/AppData/Roaming/Claude/"
    "local-agent-mode-sessions/"
    "3ec19da2-d890-4823-9585-6e9fa61beb06/"
    "1e461703-cf05-4bce-a729-e291194832f8/"
    "local_77938c64-a944-4850-9658-270a60eee238/"
    "outputs"
)
DST = Path.home() / "code/BRANDING"
LOG = Path.home() / "cloudless-branding-install.log"


def step(msg):
    print(f"\n\033[1;36m▸ {msg}\033[0m")


def ok(msg):
    print(f"  \033[1;32m✓\033[0m {msg}")


def err(msg):
    print(f"  \033[1;31m✗\033[0m {msg}", file=sys.stderr)


step("Preflight")
if not (SRC / "BRANDING").is_dir():
    err(f"Source not found: {SRC}/BRANDING")
    err("Is the Claude outputs path correct?")
    sys.exit(1)
if not (SRC / "brand").is_dir():
    err(f"Source not found: {SRC}/brand (v2 brand pack)")
    sys.exit(1)
for tool in ("git", "rsync"):
    if not shutil.which(tool):
        err(f"{tool} not installed (sudo apt install -y {tool})")
        sys.exit(1)
ok(f"source: {SRC}")
ok(f"target: {DST}")

step(f"Stage BRANDING scaffold + brand pack into {DST}")
(DST / "cloudless-brand").mkdir(parents=True, exist_ok=True)
subprocess.run(["rsync", "-a", f"{SRC}/BRANDING/", f"{DST}/"], check=True)
subprocess.run(
    ["rsync", "-a", "--ignore-existing", f"{SRC}/brand/", f"{DST}/cloudless-brand/"], check=True
)
ok("files staged")

step(f"Run setup.sh (tee'd to {LOG})")

os.chdir(DST)
for f in Path("scripts").glob("*.sh"):
    f.chmod(f.stat().st_mode | 0o111)
Path("setup.sh").chmod(0o755)
with LOG.open("w") as logf:
    p = subprocess.Popen(
        ["bash", "setup.sh"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    for line in p.stdout or ():
        print(line, end="")
        logf.write(line)
    p.wait()

step("Done.")
print(f"""
  Install log:    {LOG}
  Verify again:   bash {DST}/scripts/verify.sh
  Next on Windows:
    1. Set env vars: FIGMA_API_KEY, CANVA_CONNECT_TOKEN, BRAND_SYSTEM_API_KEY, POSTIZ_API_KEY
    2. Merge $HOME/.config/Claude/claude_desktop_config.suggested.json
       into %APPDATA%\\Claude\\claude_desktop_config.json
    3. Restart Claude Desktop""")
