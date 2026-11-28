"""Runs every watch config in scripts/watches/*.json via gmail-thread-watch.py.
One-shot — schedule this once; new watches are picked up automatically."""

import glob
import os
import subprocess

DIR = os.path.dirname(os.path.abspath(__file__))
PY = r"C:\Program Files\Python312\python.exe"

for cfg in sorted(
    c for c in glob.glob(os.path.join(DIR, "watches", "*.json")) if not c.endswith("-state.json")
):
    subprocess.call([PY, os.path.join(DIR, "gmail-thread-watch.py"), cfg])
