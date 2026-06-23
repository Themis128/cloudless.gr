#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr
source .venv/bin/activate

PYTHONPATH=. python agents/run_langchain_agents_reference.py
