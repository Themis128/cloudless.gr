#!/usr/bin/env python3
"""Curate the Deep Agents vs Claude Agent SDK comparison doc into
agents/tools/langchain_docs.py + agent memory, then test
retrieval."""

import os
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(os.environ.get("PROJECT_ROOT", Path.home() / "code/cloudless.gr"))
os.chdir(ROOT)

DOC_TOOL = ROOT / "agents/tools/langchain_docs.py"
MEMORY_FILE = ROOT / ".agent-memory/memories/AGENTS.md"

if not DOC_TOOL.is_file():
    print(f"❌ Missing {DOC_TOOL}")
    print("Run your LangChain docs tooling setup first.")
    sys.exit(1)

shutil.copy(DOC_TOOL, DOC_TOOL.with_suffix(f".py.bak-{time.strftime('%Y%m%d-%H%M%S')}"))

text = DOC_TOOL.read_text(encoding="utf-8")
needle = "CURATED_DOCS = ["
entry = """    {
        "title": "Deep Agents comparison with Claude Agent SDK",
        "url": "https://docs.langchain.com/oss/python/deepagents/comparison.md",
        "keywords": {
            "deep",
            "agents",
            "deepagents",
            "comparison",
            "claude",
            "claude-agent-sdk",
            "sdk",
            "sandbox",
            "backend",
            "deployment",
            "multi-tenancy",
            "model-provider",
        },
    },
"""

if "deepagents/comparison.md" in text:
    print("✅ Comparison doc already curated.")
else:
    DOC_TOOL.write_text(text.replace(needle, needle + "\n" + entry), encoding="utf-8")
    print("✅ Added Deep Agents comparison doc to curated docs.")

MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)
NOTE = (
    "For Deep Agents vs Claude Agent SDK architecture "
    "questions, use the official comparison page: "
    "https://docs.langchain.com/oss/python/deepagents/"
    "comparison.md"
)

if not MEMORY_FILE.is_file():
    MEMORY_FILE.write_text(f"# cloudless.gr Agent Memory\n\n## Documentation workflow\n- {NOTE}\n")
    print("✅ Created memory file and added comparison note.")
elif NOTE in MEMORY_FILE.read_text():
    print("✅ Memory note already exists.")
else:
    with MEMORY_FILE.open("a") as f:
        f.write(f"\n## Documentation workflow\n- {NOTE}\n")
    print("✅ Added comparison note to memory.")

print("\nTesting retrieval...")
sys.path.insert(0, str(ROOT))
from agents.tools.langchain_docs import search_langchain_docs_index  # noqa: E402

for item in search_langchain_docs_index(
    "Deep Agents vs Claude Agent SDK comparison sandbox backend deployment model provider",
    max_results=8,
):
    print(f"- {item['title']} -> {item['url']}")

print("""
✅ Done. Try:
PYTHONPATH=. python agents/run_langchain_docs_research.py "Compare Deep Agents with Claude Agent SDK for my local vLLM-powered cloudless.gr agent architecture."
""")
