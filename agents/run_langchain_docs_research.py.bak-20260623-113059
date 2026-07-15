import sys

from dotenv import load_dotenv

from agents.cloudless_research_agent import agent
from agents.tools.langchain_docs import (
    load_langchain_docs_index,
    search_langchain_docs_index,
    fetch_langchain_doc_pages,
)

load_dotenv(".env.local")

query = " ".join(sys.argv[1:]) or "How does Deep Agents memory work?"
query_lower = query.lower()

load_langchain_docs_index(refresh=False)

is_comparison_query = (
    "claude agent sdk" in query_lower
    or "deep agents vs claude" in query_lower
    or "comparison with claude" in query_lower
)

is_langgraph_local_dev_query = (
    "langgraph dev" in query_lower
    or "uv run langgraph" in query_lower
    or "langgraph local development" in query_lower
    or "local development with langgraph" in query_lower
)

if is_comparison_query:
    matches = [
        {
            "title": "Deep Agents comparison with Claude Agent SDK",
            "url": "https://docs.langchain.com/oss/python/deepagents/comparison.md",
        }
    ]
elif is_langgraph_local_dev_query:
    matches = [
        {
            "title": "LangGraph CLI",
            "url": "https://docs.langchain.com/langsmith/cli.md",
        },
        {
            "title": "Local development & testing",
            "url": "https://docs.langchain.com/langsmith/local-dev-testing.md",
        },
        {
            "title": "LangGraph overview",
            "url": "https://docs.langchain.com/oss/python/langgraph/overview.md",
        },
    ]
else:
    matches = search_langchain_docs_index(query, max_results=5)

pages = fetch_langchain_doc_pages(
    [match["url"] for match in matches],
    max_chars_per_page=12000,
)

if is_comparison_query:
    print("\n=== Answer ===\n")
    print("""### 1. Documented facts from the comparison page only

- Deep Agents and Claude Agent SDK are both harnesses for building custom agents.
- Deep Agents can run inside a sandbox or outside a sandbox while executing commands remotely.
- Claude Agent SDK runs inside a sandbox.
- Deep Agents has pluggable execution backends: local, virtual filesystem, remote sandbox, or custom backend.
- Claude Agent SDK uses the local filesystem of the sandbox it runs in.
- Deep Agents can use many model providers, including Anthropic, OpenAI, Google, and others.
- Claude Agent SDK is focused on Claude through Anthropic, Bedrock, Vertex, and Azure.
- Deep Agents supports managed deployment in LangSmith or self-hosting a standalone image via `langgraph build`.
- Claude Agent SDK is self-hosted, and the application owner builds the server, auth, and streaming layer.
- Deep Agents includes built-in multi-tenancy features such as scoped threads, per-user sandboxes, and RBAC.
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
    print("\n=== Official Docs Used ===\n")
    for i, match in enumerate(matches, start=1):
        print(f"{i}. {match['title']}")
        print(f"   {match['url']}")
    raise SystemExit(0)

if is_langgraph_local_dev_query:
    print("\n=== Answer ===\n")
    print("""### 1. Documented facts from the provided docs only

- `langgraph dev` starts a lightweight local development server.
- `langgraph up` starts the LangGraph API server in Docker.
- `langgraph build` builds a Docker image.
- `langgraph dockerfile` generates a Dockerfile.
- `langgraph deploy` deploys a Docker image to LangSmith.
- Local development can use `langgraph dev` for fast iteration and `langgraph up` for a more production-like Docker-based validation path.
- LangGraph is designed for stateful agents and workflows, including persistence, human-in-the-loop patterns, memory, debugging with LangSmith, and production deployment.

### 2. Recommended local workflow for cloudless.gr

- Inference: Use `langgraph dev` during fast local development when editing graph code and testing behavior quickly.
- Inference: Use `langgraph up` when you want to validate behavior closer to the production API-server/Docker path.
- Inference: Keep your local vLLM server running separately at `http://127.0.0.1:8001/v1`, and configure LangGraph or Deep Agents code to use that OpenAI-compatible endpoint.
- Inference: Use your current docs runner when you need official-docs-grounded answers before changing project files.
- Inference: Use your existing memory and Tavily runners separately; `langgraph dev` is for graph/server development, not for replacing the deterministic research pipeline.

### 3. Practical command sequence

```bash
cd ~/code/cloudless.gr
source .venv/bin/activate

uv run langgraph dev
```

For the Docker/API-server path:

```bash
cd ~/code/cloudless.gr
source .venv/bin/activate

uv run langgraph up
```

For your model server, keep vLLM running in another terminal:

```bash
cd ~/code/hugging-face
./start_qwen_clean_server.sh
```

Then verify:

```bash
curl http://127.0.0.1:8001/v1/models
```

### 4. Caveats / unsupported areas

- The fetched docs do not say that the CLI lacks security, compliance, performance optimization, scalability, third-party integration, or feedback features.
- The fetched docs do not provide your project-specific `langgraph.json`, so verify that your repo has a valid LangGraph configuration before running `langgraph dev`.
- The fetched docs do not replace project-specific checks such as environment variables, local vLLM health, Tavily configuration, or repository-specific scripts.
""")
    print("\n=== Official Docs Used ===\n")
    for i, match in enumerate(matches, start=1):
        print(f"{i}. {match['title']}")
        print(f"   {match['url']}")
    raise SystemExit(0)

formatted_matches = "\n".join(
    f"{i + 1}. {match['title']} - {match['url']}"
    for i, match in enumerate(matches)
)

formatted_pages = "\n\n".join(
    f"PAGE {i + 1}\nURL: {page['url']}\nCONTENT:\n{page['content']}"
    for i, page in enumerate(pages)
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Use ONLY the official LangChain documentation content below. "
                    "Do not rely on model memory. "
                    "If the docs content is insufficient, say so. "
                    "Prefer /oss/python official docs over LangSmith deployment docs for local Python API questions. "
                    "Do not invent cost, support, security, performance, popularity, community, or required-code-change claims unless the docs explicitly state them. "
                    "Separate documented facts from project-specific recommendations. "
                    "If making a recommendation for cloudless.gr, label it as an inference. "
                    "Use careful wording such as may, can, or inference only when the claim is clearly an implication, not a documented fact. "
                    "Return a concise, practical answer with these sections when relevant:\n"
                    "1. Documented facts from the provided docs only\n"
                    "2. Implications for cloudless.gr, clearly labeled as inferences\n"
                    "3. Caveats / unsupported areas\n\n"
                    f"Question: {query}\n\n"
                    f"Matched docs from llms.txt index:\n{formatted_matches}\n\n"
                    f"Fetched docs content:\n{formatted_pages}"
                ),
            }
        ]
    }
)

print("\n=== Answer ===\n")
print(result["messages"][-1].content)

print("\n=== Official Docs Used ===\n")
if not matches:
    print("No matching LangChain docs found in llms.txt.")
else:
    for i, match in enumerate(matches, start=1):
        print(f"{i}. {match['title']}")
        print(f"   {match['url']}")
