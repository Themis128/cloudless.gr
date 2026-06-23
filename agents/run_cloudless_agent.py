import sys

from dotenv import load_dotenv

from agents.cloudless_research_agent import agent
from agents.tools.search import internet_search

load_dotenv(".env.local")

query = " ".join(sys.argv[1:]) or "What is LangGraph?"

search_response = internet_search(
    query=query,
    max_results=5,
    topic="general",
    include_raw_content=False,
)

results = search_response.get("results", [])

formatted_sources = "\n\n".join(
    [
        f"Source {i + 1}:\n"
        f"Title: {item.get('title')}\n"
        f"URL: {item.get('url')}\n"
        f"Content: {item.get('content')}"
        for i, item in enumerate(results)
    ]
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Answer the question using ONLY the Tavily search results below. "
                    "Do not rely on model memory. "
                    "If the search results are insufficient, say so. "
                    "Prefer official documentation when present. "
                    "Do not make broad comparisons unless the provided sources explicitly support them. "
                    "Write 3-5 concise bullet points. "
                    "Include no claims that are not supported by the provided search results.\n\n"
                    f"Question: {query}\n\n"
                    f"Tavily search results:\n{formatted_sources}"
                ),
            }
        ]
    }
)

print("\n=== Answer ===\n")
print(result["messages"][-1].content)

print("\n=== Sources ===\n")
if not results:
    print("No Tavily sources returned.")
else:
    for i, item in enumerate(results, start=1):
        title = item.get("title") or "Untitled"
        url = item.get("url") or "No URL"
        print(f"{i}. {title}")
        print(f"   {url}")
