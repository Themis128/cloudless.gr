#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/code/cloudless.gr}"
DOC_TOOL="$PROJECT_ROOT/agents/tools/langchain_docs.py"
MEMORY_FILE="$PROJECT_ROOT/.agent-memory/memories/AGENTS.md"

cd "$PROJECT_ROOT"

if [ ! -f "$DOC_TOOL" ]; then
  echo "❌ Missing $DOC_TOOL"
  echo "Run your LangChain docs tooling setup first."
  exit 1
fi

cp "$DOC_TOOL" "$DOC_TOOL.bak-$(date +%Y%m%d-%H%M%S)"

python - <<'PY'
from pathlib import Path

path = Path("agents/tools/langchain_docs.py")
text = path.read_text(encoding="utf-8")

needle = 'CURATED_DOCS = ['
entry = '''    {
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
'''

if "deepagents/comparison.md" in text:
    print("✅ Comparison doc already curated.")
else:
    text = text.replace(needle, needle + "\n" + entry)
    path.write_text(text, encoding="utf-8")
    print("✅ Added Deep Agents comparison doc to curated docs.")
PY

mkdir -p "$(dirname "$MEMORY_FILE")"

NOTE="For Deep Agents vs Claude Agent SDK architecture questions, use the official comparison page: https://docs.langchain.com/oss/python/deepagents/comparison.md"

if [ ! -f "$MEMORY_FILE" ]; then
  cat > "$MEMORY_FILE" <<EOF
# cloudless.gr Agent Memory

## Documentation workflow
- $NOTE
EOF
  echo "✅ Created memory file and added comparison note."
elif grep -Fq "$NOTE" "$MEMORY_FILE"; then
  echo "✅ Memory note already exists."
else
  cat >> "$MEMORY_FILE" <<EOF

## Documentation workflow
- $NOTE
EOF
  echo "✅ Added comparison note to memory."
fi

echo
echo "Testing retrieval..."
PYTHONPATH=. python - <<'PY'
from agents.tools.langchain_docs import search_langchain_docs_index

query = "Deep Agents vs Claude Agent SDK comparison sandbox backend deployment model provider"
for item in search_langchain_docs_index(query, max_results=8):
    print(f"- {item['title']} -> {item['url']}")
PY

echo
echo "✅ Done. Try:"
echo 'PYTHONPATH=. python agents/run_langchain_docs_research.py "Compare Deep Agents with Claude Agent SDK for my local vLLM-powered cloudless.gr agent architecture."'
