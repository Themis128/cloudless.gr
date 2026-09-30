#!/usr/bin/env python3
"""LangChain v1 experiment runner — release-page research, agents
reference, and three local-vLLM create_agent experiments.

Runs inside the repo .venv with PYTHONPATH=. — same as the original
scripts/1.sh."""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path.home() / "code" / "cloudless.gr"
os.chdir(ROOT)

python = ROOT / ".venv" / "bin" / "python"
if not python.exists():
    sys.exit("missing .venv — create it first")

env = {**os.environ, "PYTHONPATH": "."}

runs = [
    ("LangChain v1 release page runner",
     "agents/run_langchain_v1_research.py"),
    ("LangChain Agents reference runner",
     "agents/run_langchain_agents_reference.py"),
    ("LangChain v1 create_agent local vLLM experiment",
     "agents/experiments/langchain_v1_create_agent_local_vllm.py"),
    ("LangChain v1 ModelRequest middleware local vLLM experiment",
     "agents/experiments/"
     "langchain_v1_modelrequest_middleware_local_vllm.py"),
    ("LangChain v1 structured output local vLLM experiment",
     "agents/experiments/"
     "langchain_v1_structured_output_local_vllm.py"),
]

for label, script in runs:
    print(f"\n=== {label} ===")
    subprocess.run([str(python), script], env=env)
