#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr
source .venv/bin/activate

echo "=== LangChain v1 release page runner ==="
PYTHONPATH=. python agents/run_langchain_v1_research.py

echo
echo "=== LangChain Agents reference runner ==="
PYTHONPATH=. python agents/run_langchain_agents_reference.py

echo
echo "=== LangChain v1 create_agent local vLLM experiment ==="
PYTHONPATH=. python agents/experiments/langchain_v1_create_agent_local_vllm.py

echo
echo "=== LangChain v1 ModelRequest middleware local vLLM experiment ==="
PYTHONPATH=. python agents/experiments/langchain_v1_modelrequest_middleware_local_vllm.py
