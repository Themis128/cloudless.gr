#!/usr/bin/env python3
"""Legacy LangChain import audit + installed package versions."""

import importlib.metadata as md
import re
import sys
from pathlib import Path

ROOT = Path.home() / "code/cloudless.gr"
import os
os.chdir(ROOT)

print("=== Legacy LangChain import audit ===\n")

RX = re.compile(
    r"create_react_agent|langchain\.chains|"
    r"langchain\.retrievers|from langchain import hub"
    r"|from langchain import")
SKIP = {".venv", "node_modules", ".git", ".next"}

for base in ("agents", "src", "app"):
    p = Path(base)
    if not p.exists():
        continue
    for f in p.rglob("*"):
        if not f.is_file() or any(d in f.parts
                                  for d in SKIP):
            continue
        if f.name == "run_langchain_v1_research.py":
            continue
        try:
            for i, line in enumerate(
                    f.read_text(errors="replace")
                    .splitlines(), 1):
                if RX.search(line):
                    print(f"{f}:{i}:{line}")
        except Exception:
            continue

print("\n=== Installed package versions ===")
for pkg in ("langchain", "langchain-core",
            "langchain-openai", "langgraph", "deepagents"):
    try:
        print(pkg, md.version(pkg))
    except md.PackageNotFoundError:
        print(pkg, "not installed")
