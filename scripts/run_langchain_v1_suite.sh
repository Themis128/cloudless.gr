#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr
source .venv/bin/activate

run_if_exists() {
  local label="$1"
  local path="$2"
  echo
  echo "=== $label ==="
  if [ -f "$path" ]; then
    PYTHONPATH=. python "$path"
  else
    echo "SKIP: missing $path"
  fi
}

run_if_exists "LangChain v1 release page runner" "agents/run_langchain_v1_research.py"
run_if_exists "LangChain Agents reference runner" "agents/run_langchain_agents_reference.py"
run_if_exists "LangChain v1 create_agent local vLLM experiment" "agents/experiments/langchain_v1_create_agent_local_vllm.py"
run_if_exists "LangChain v1 ModelRequest middleware local vLLM experiment" "agents/experiments/langchain_v1_modelrequest_middleware_local_vllm.py"
run_if_exists "LangChain v1 structured output local vLLM experiment" "agents/experiments/langchain_v1_structured_output_local_vllm.py"
