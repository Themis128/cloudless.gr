#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -d ".venv" ]; then
  source .venv/bin/activate
fi

case "${1:-help}" in
  test)
    python scripts/test_vllm_connection.py
    ;;

  check)
    python scripts/check_deepagent_cloudless.py
    ;;

  skills-check)
    python scripts/check_deepagent_skills.py
    ;;

  ingest-docs)
    python scripts/ingest_langchain_docs_focused.py
    ;;

  ingest-repo)
    python scripts/ingest_repo_docs.py
    ;;

  ingest-all)
    python scripts/ingest_langchain_docs_focused.py
    python scripts/ingest_repo_docs.py
    ;;

  docs)
    python agents/langchain_docs_fast_rag.py
    ;;

  repo)
    python agents/cloudless_repo_fast_rag.py
    ;;

  unified)
    python agents/cloudless_unified_assistant.py
    ;;

  deep-smoke)
    python agents/cloudless_deep_agent_smoke.py
    ;;

  deep)
    python agents/cloudless_deep_agent.py
    ;;

  langsmith-check)
    python scripts/check_langsmith_api_clients.py
    ;;

  langsmith-call)
    shift
    if [ "${1:-}" = "--" ]; then
      shift
    fi
    python scripts/langsmith_api_call.py "$@"
    ;;

  langsmith-page)
    shift
    if [ "${1:-}" = "--" ]; then
      shift
    fi
    python scripts/langsmith_api_page.py "$@"
    ;;

  langsmith-stream)
    shift
    if [ "${1:-}" = "--" ]; then
      shift
    fi
    python scripts/langsmith_api_stream.py "$@"
    ;;

  langsmith-endpoint)
    shift
    if [ "${1:-}" = "--" ]; then
      shift
    fi
    python scripts/langsmith_endpoint_call.py "$@"
    ;;

  *)
    cat <<'EOF'
Usage: ./scripts/ai.sh <command>

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
  langsmith-check    Check LangSmith API clients
  langsmith-call     Generic LangSmith API caller
  langsmith-page     Paginated LangSmith API caller
  langsmith-stream   Streaming LangSmith API caller
  langsmith-endpoint Registered endpoint caller
EOF
    ;;
esac
