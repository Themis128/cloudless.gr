#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr

cp agents/run_langchain_docs_research.py "agents/run_langchain_docs_research.py.bak-$(date +%Y%m%d-%H%M%S)"

cat > agents/run_langchain_docs_research.py <<'PY'
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

if is_comparison_query:
    matches = [
        {
            "title": "Deep Agents comparison with Claude Agent SDK",
            "url": "https://docs.langchain.com/oss/python/deepagents/comparison.md",
        }
    ]
else:
    matches = search_langchain_docs_index(query, max_results=5)

pages = fetch_langchain_doc_pages(
    [match["url"] for match in matches],
    max_chars_per_page=12000,
)

formatted_matches = "\n".join(
    f"{i + 1}. {match['title']} - {match['url']}"
    for i, match in enumerate(matches)
)

formatted_pages = "\n\n".join(
    f"PAGE {i + 1}\nURL: {page['url']}\nCONTENT:\n{page['content']}"
    for i, page in enumerate(pages)
)

if is_comparison_query:
    instructions = (
        "Use ONLY the official LangChain comparison documentation below. "
        "Do not rely on model memory. "
        "Compare ONLY dimensions explicitly stated in the fetched comparison page. "
        "Do not add product limitations, caveats, support claims, cost claims, security claims, "
        "performance claims, or required-code-change claims unless the fetched page explicitly states them. "
        "Do not write 'limited support' unless the fetched page explicitly uses that phrase. "
        "If the page says Deep Agents supports a capability, do not list that capability as a caveat or limitation. "
        "For cloudless.gr implications, label every implication as an inference. "
        "Keep the answer concise and practical.\n\n"
        "Return exactly these sections:\n"
        "1. Documented facts from the comparison page only\n"
        "2. Inferences for local vLLM-powered cloudless.gr architecture\n"
        "3. Caveats / unsupported areas from the fetched docs\n\n"
        "In section 3, if the fetched docs do not explicitly state caveats relevant to the question, write: "
        "'No additional caveats are explicitly stated in the fetched comparison page.'\n\n"
    )
else:
    instructions = (
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
    )

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    instructions
                    + f"Question: {query}\n\n"
                    + f"Matched docs from llms.txt index:\n{formatted_matches}\n\n"
                    + f"Fetched docs content:\n{formatted_pages}"
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
PY

echo "✅ Patched comparison-specific docs runner."
