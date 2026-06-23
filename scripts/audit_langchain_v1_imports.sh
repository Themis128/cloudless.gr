#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr
source .venv/bin/activate

echo "=== Legacy LangChain import audit ==="

grep -R \
  --exclude-dir=.venv \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.next \
  --exclude=run_langchain_v1_research.py \
  "create_react_agent\|langchain.chains\|langchain.retrievers\|from langchain import hub\|from langchain import" \
  -n agents src app . 2>/dev/null || true

echo

echo "=== Installed package versions ==="
python - <<'PY'
import importlib.metadata as md

for package in ["langchain", "langchain-core", "langchain-openai", "langgraph", "deepagents"]:
    try:
        print(package, md.version(package))
    except md.PackageNotFoundError:
        print(package, "not installed")
PY
