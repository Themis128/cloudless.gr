#!/usr/bin/env python3
"""Run the four LangChain v1 experiment/research runners inside
.venv."""

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

STEPS = [
    ("LangChain v1 release page runner",
     "agents/run_langchain_v1_research.py"),
    ("LangChain Agents reference runner",
     "agents/run_langchain_agents_reference.py"),
    ("LangChain v1 create_agent local vLLM experiment",
     "agents/experiments/"
     "langchain_v1_create_agent_local_vllm.py"),
    ("LangChain v1 ModelRequest middleware local vLLM "
     "experiment",
     "agents/experiments/"
     "langchain_v1_modelrequest_middleware_local_vllm.py"),
]

for label, path in STEPS:
    print(f"=== {label} ===")
    r = subprocess.call([python, path], env=env)
    if r != 0:
        sys.exit(r)
    print()
