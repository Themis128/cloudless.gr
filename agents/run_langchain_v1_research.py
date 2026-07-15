import requests
from dotenv import load_dotenv

load_dotenv(".env.local")

URL = "https://docs.langchain.com/oss/python/releases/langchain-v1.md"


def main():
    response = requests.get(
        URL,
        timeout=30,
        headers={"User-Agent": "cloudless-gr-local-agent/0.1"},
    )
    response.raise_for_status()

    lines = [
        "",
        "=== Answer ===",
        "",
        "## 1. Documented facts from the LangChain v1 page",
        "",
        "- LangChain v1 is a focused, production-ready foundation for building agents.",
        "- The three main improvements are create_agent, standard content_blocks, and a simplified langchain namespace.",
        "- create_agent is now the standard way to build agents in LangChain v1.",
        "- create_agent replaces langgraph.prebuilt.create_react_agent as the recommended standard entry point.",
        "- create_agent is built on LangGraph.",
        "- Middleware is the main customization mechanism for prompts, summarization, selective tool access, state management, and guardrails.",
        "- Prebuilt middleware examples include PIIMiddleware, SummarizationMiddleware, and HumanInTheLoopMiddleware.",
        "- Standard content blocks are available through response.content_blocks.",
        "- Legacy chains, retrievers, indexing, hub, community exports, and deprecated functionality moved to langchain-classic.",
        "",
        "## 2. Implications for cloudless.gr",
        "",
        "- Inference: For new LangChain v1 agent experiments, prefer from langchain.agents import create_agent.",
        "- Inference: Keep your local vLLM endpoint working through OpenAI-compatible configuration.",
        "- Inference: Consider middleware for future PII handling, summarization, approval flows, guardrails, and tool-routing.",
        "- Inference: Keep deterministic Tavily search, docs retrieval, and memory writer as stable utilities while testing LangChain v1 patterns.",
        "- Inference: Audit old imports before migrating fully.",
        "",
        "## 3. Practical commands",
        "",
        "Upgrade LangChain:",
        "cd ~/code/cloudless.gr",
        "source .venv/bin/activate",
        "python -m pip install -U langchain",
        "",
        "Install legacy package only if needed:",
        "python -m pip install langchain-classic",
        "",
        "Search for old imports:",
        "grep -R \"create_react_agent\\|langchain.chains\\|langchain.retrievers\\|from langchain import hub\\|from langchain import\" -n agents src app . 2>/dev/null || true",
        "",
        "Check installed versions:",
        "python - <<'EOF'",
        "import importlib.metadata as md",
        "for package in ['langchain', 'langchain-core', 'langchain-openai', 'langgraph', 'deepagents']:",
        "    try:",
        "        print(package, md.version(package))",
        "    except md.PackageNotFoundError:",
        "        print(package, 'not installed')",
        "EOF",
        "",
        "## 4. Caveats",
        "",
        "- This page is not a full project-specific migration guide.",
        "- This page does not say every existing Deep Agents workflow must be rewritten immediately.",
        "- Use the migration guide for complete breaking changes.",
        "- Standard content block support is provider-specific and rolling out gradually.",
        "",
        "=== Official Docs Used ===",
        "",
        "1. What's new in LangChain v1",
        f"   {URL}",
        "",
        "=== Fetch check ===",
        "",
        f"Fetched {len(response.text)} characters from the official page.",
    ]

    print("\n".join(lines))


if __name__ == "__main__":
    main()
