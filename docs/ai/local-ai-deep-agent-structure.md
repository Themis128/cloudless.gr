# cloudless.gr read-only Deep Agent structure

The canonical local AI / Deep Agent workflow should use the existing project files.

## Agent entrypoints

- `agents/cloudless_deep_agent.py` — main read-only Deep Agent.
- `agents/cloudless_deep_agent_smoke.py` — smoke test for Deep Agent runtime.
- `agents/cloudless_unified_assistant.py` — combined repo + LangChain docs assistant.
- `agents/cloudless_repo_fast_rag.py` — repo-only RAG assistant.
- `agents/langchain_docs_fast_rag.py` — LangChain docs-only RAG assistant.
- `agents/local_qwen_agent.py` — basic local Qwen/LangChain agent.

## Scripts

- `scripts/ai.sh` — single CLI wrapper for local AI commands.
- `scripts/check_deepagent_cloudless.py` — readiness checker.
- `scripts/test_vllm_connection.py` — vLLM smoke test.
- `scripts/ingest_repo_docs.py` — builds `.deepagents/cloudless_repo_chroma/`.
- `scripts/ingest_langchain_docs_focused.py` — builds `.deepagents/langchain_docs_chroma/`.

## Generated vector stores

- `.deepagents/cloudless_repo_chroma/` — local repo vector DB.
- `.deepagents/langchain_docs_chroma/` — focused LangChain docs vector DB.

## Rules

- The Deep Agent is read-only.
- It should not modify files.
- It should not output secrets.
- It should prefer existing files over new generic structure.
- New files should only be suggested when clearly marked optional.
- New files should only be suggested when clearly marked optional.
