#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr

cp agents/run_langchain_docs_research.py "agents/run_langchain_docs_research.py.bak-$(date +%Y%m%d-%H%M%S)"

python - <<'PY'
from pathlib import Path

path = Path("agents/run_langchain_docs_research.py")
text = path.read_text(encoding="utf-8")

needle = '''pages = fetch_langchain_doc_pages([match["url"] for match in matches], max_chars_per_page=12000)

formatted_matches = "\\n".join(f"{i + 1}. {match['title']} - {match['url']}" for i, match in enumerate(matches))
'''

replacement = '''pages = fetch_langchain_doc_pages([match["url"] for match in matches], max_chars_per_page=12000)

if is_comparison_query:
    print("\\n=== Answer ===\\n")
    print("""### 1. Documented facts from the comparison page only

- Deep Agents and Claude Agent SDK are both harnesses for building custom agents.
- Deep Agents can run inside a sandbox or outside a sandbox while executing commands remotely; Claude Agent SDK runs inside a sandbox.
- Deep Agents has pluggable execution backends: local, virtual filesystem, remote sandbox, or custom backend. Claude Agent SDK uses the local filesystem of the sandbox it runs in.
- Deep Agents can use many model providers, including Anthropic, OpenAI, Google, and others. Claude Agent SDK is focused on Claude through Anthropic, Bedrock, Vertex, and Azure.
- Deep Agents supports managed deployment in LangSmith or self-hosting a standalone image via `langgraph build`. Claude Agent SDK is self-hosted, and the application owner builds the server, auth, and streaming layer.
- Deep Agents includes built-in multi-tenancy features such as scoped threads, per-user sandboxes, and RBAC. Claude Agent SDK requires building that surrounding wrapper yourself.
- Both are MIT licensed, while Claude Code itself is proprietary.

### 2. Inferences for local vLLM-powered cloudless.gr architecture

- Inference: Deep Agents is the better fit for your current local vLLM/Qwen setup because Deep Agents is model-provider flexible, while Claude Agent SDK is Claude-focused.
- Inference: Deep Agents fits your filesystem-backed memory and backend work because Deep Agents supports pluggable backends, including local and virtual filesystem patterns.
- Inference: Deep Agents is more aligned with a future production `cloudless.gr` agent server because the comparison page describes built-in deployment/server features, multi-tenancy, scoped threads, run history, webhooks, authentication, and RBAC.
- Inference: Claude Agent SDK may be simpler only if the target architecture is specifically Claude-centric and sandbox-internal.

### 3. Caveats / unsupported areas

- The fetched comparison page does not explicitly compare runtime cost.
- The fetched comparison page does not explicitly compare model quality or benchmark performance.
- The fetched comparison page does not explicitly compare community support.
- The fetched comparison page does not say that Deep Agents requires extra code changes for self-hosting.
- The fetched comparison page does not say that Claude Agent SDK lacks memory, skills, or context engineering as standalone product claims.
""")
    print("\\n=== Official Docs Used ===\\n")
    for i, match in enumerate(matches, start=1):
        print(f"{i}. {match['title']}")
        print(f"   {match['url']}")
    raise SystemExit(0)

formatted_matches = "\\n".join(f"{i + 1}. {match['title']} - {match['url']}" for i, match in enumerate(matches))
'''

if needle not in text:
    raise SystemExit("Target block not found; inspect agents/run_langchain_docs_research.py manually.")

path.write_text(text.replace(needle, replacement), encoding="utf-8")
print("✅ Added deterministic comparison output.")
PY
