#!/usr/bin/env python3
"""AI dispatcher — same command surface as ai.sh, runs each
subcommand through the .venv Python.

Usage: python3 scripts/ai.py <command> [--] [args...]"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)

VENV_PY = ROOT / ".venv/bin/python"
PYTHON = str(VENV_PY) if VENV_PY.exists() else sys.executable

USAGE = """\
Usage: ai.py <command>

Commands:
  test               Test local vLLM connection
  check              Check Deep Agent readiness
  skills-check       Check Deep Agent tools and skills
  ingest-docs        Rebuild LangChain docs vector DB
  ingest-repo        Rebuild cloudless.gr repo vector DB
  ingest-all         Rebuild both vector DBs
  docs               Run LangChain docs assistant
  repo               Run repo assistant
  unified            Run unified repo + docs assistant
  deep-smoke         Run Deep Agent smoke test
  deep               Run main cloudless.gr Deep Agent
  fast-answer        Fast deterministic app-config answer
  vibe-patch         Create deterministic patch proposal
  vibe-review        Review deterministic patch proposal
  vibe-status        Show patch proposal readiness status
  vibe-plan          Create implementation plan from proposal
  troubleshoot       Run read-only troubleshooting workflow
  analyze-app        Analyze app area with deterministic checks
  langsmith-check    Check LangSmith API clients
  langsmith-call     Generic LangSmith API caller
  langsmith-page     Paginated LangSmith API caller
  langsmith-stream   Streaming LangSmith API caller
  langsmith-endpoint Registered endpoint caller"""

# commands that take no extra args: (script path)
SIMPLE = {
    "test": ["scripts/test_vllm_connection.py"],
    "check": ["scripts/check_deepagent_cloudless.py"],
    "skills-check": ["scripts/check_deepagent_skills.py"],
    "ingest-docs": ["scripts/ingest_langchain_docs_focused.py"],
    "ingest-repo": ["scripts/ingest_repo_docs.py"],
    "ingest-all": ["scripts/ingest_langchain_docs_focused.py",
                   "scripts/ingest_repo_docs.py"],
    "docs": ["agents/langchain_docs_fast_rag.py"],
    "repo": ["agents/cloudless_repo_fast_rag.py"],
    "unified": ["agents/cloudless_unified_assistant.py"],
    "deep-smoke": ["agents/cloudless_deep_agent_smoke.py"],
    "deep": ["agents/cloudless_deep_agent.py"],
    "langsmith-check":
        ["scripts/check_langsmith_api_clients.py"],
}

# commands that forward extra args
WITH_ARGS = {
    "fast-answer": "scripts/cloudless_fast_answer.py",
    "vibe-patch": "scripts/vibe_patch.py",
    "vibe-review": "scripts/vibe_review.py",
    "vibe-status": "scripts/vibe_status.py",
    "vibe-plan": "scripts/vibe_plan.py",
    "troubleshoot": "scripts/troubleshoot.py",
    "analyze-app": "scripts/analyze_app.py",
    "langsmith-call": "scripts/langsmith_api_call.py",
    "langsmith-page": "scripts/langsmith_api_page.py",
    "langsmith-stream": "scripts/langsmith_api_stream.py",
    "langsmith-endpoint":
        "scripts/langsmith_endpoint_call.py",
}

cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
rest = sys.argv[2:]
if rest and rest[0] == "--":
    rest = rest[1:]

if cmd in SIMPLE:
    for script in SIMPLE[cmd]:
        r = subprocess.call([PYTHON, script])
        if r != 0:
            sys.exit(r)
elif cmd in WITH_ARGS:
    sys.exit(subprocess.call(
        [PYTHON, WITH_ARGS[cmd], *rest]))
else:
    print(USAGE)
    if cmd != "help":
        sys.exit(2)
