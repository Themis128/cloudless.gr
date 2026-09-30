#!/usr/bin/env python3
"""lint-yaml.py — yamllint (all YAML) + actionlint (GitHub Actions workflows)"""

import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS_BIN = ROOT / ".tools" / "bin"
TOOLS_PY = ROOT / ".tools" / "python"
TOOLS_BIN.mkdir(parents=True, exist_ok=True)
TOOLS_PY.mkdir(parents=True, exist_ok=True)

os.environ["PYTHONPATH"] = (
    f"{TOOLS_PY}:{os.environ['PYTHONPATH']}"
    if os.environ.get("PYTHONPATH") else str(TOOLS_PY))


def ensure_yamllint() -> None:
    try:
        import yamllint  # noqa: F401
        return
    except ImportError:
        pass
    exe = shutil.which("yamllint")
    if exe and not exe.startswith(str(TOOLS_PY)):
        return
    print("[lint:yaml] installing yamllint into .tools/python …",
          file=sys.stderr)
    subprocess.run([sys.executable, "-m", "pip", "install", "--target",
                    str(TOOLS_PY), "yamllint>=1.35,<2", "-q"], check=True)
    try:
        import yamllint  # noqa: F401
    except ImportError:
        print("[lint:yaml] yamllint import failed after install",
              file=sys.stderr)
        sys.exit(1)


def run_yamllint(*args: str) -> int:
    exe = shutil.which("yamllint")
    if exe and not exe.startswith(str(TOOLS_PY)):
        return subprocess.call([exe, *args])
    return subprocess.call([sys.executable, "-m", "yamllint", *args])


def ensure_actionlint() -> str:
    exe = shutil.which("actionlint")
    if exe:
        return exe
    local = TOOLS_BIN / "actionlint"
    if os.access(local, os.X_OK):
        return str(local)
    print("[lint:yaml] downloading actionlint into .tools/bin …",
          file=sys.stderr)
    url = ("https://raw.githubusercontent.com/rhysd/actionlint/main/"
           "scripts/download-actionlint.bash")
    try:
        script = urllib.request.urlopen(url, timeout=30).read()
        subprocess.run(["bash", "-s", "--", "latest", str(TOOLS_BIN)],
                       input=script, cwd=TOOLS_BIN,
                       capture_output=True)
    except Exception:
        pass
    if not os.access(local, os.X_OK):
        print("[lint:yaml] actionlint install failed", file=sys.stderr)
        sys.exit(1)
    return str(local)


ensure_yamllint()
actionlint = ensure_actionlint()

print("==> yamllint")
rc = run_yamllint(str(ROOT))
if rc:
    sys.exit(rc)

print("==> actionlint (.github/workflows)")
wf_dir = ROOT / ".github" / "workflows"
wf_files = sorted(
    str(p) for p in wf_dir.iterdir()
    if p.suffix in (".yml", ".yaml") and not p.name.endswith(".lock.yml"))
rc = subprocess.call([
    actionlint,
    "-ignore", 'unexpected key "queue"',
    "-ignore", 'context "secrets" is not allowed',
    "-ignore", "shellcheck reported issue in this script: .*",
    *wf_files])
if rc:
    sys.exit(rc)

print("YAML lint OK")
