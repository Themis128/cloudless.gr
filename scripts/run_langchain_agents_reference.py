#!/usr/bin/env python3
"""Run the LangChain Agents reference runner inside .venv."""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path.home() / "code/cloudless.gr"
os.chdir(ROOT)

env = dict(os.environ)
env["PYTHONPATH"] = "."
py = ROOT / ".venv/bin/python"
python = str(py) if py.exists() else sys.executable
sys.exit(subprocess.call([python, "agents/run_langchain_agents_reference.py"], env=env))
