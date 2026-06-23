import sys

from dotenv import load_dotenv

from agents.cloudless_research_agent import agent
from agents.tools.search import internet_search

load_dotenv(".env.local")

query = " ".join(sys.argv[1:]) or (
    "Cloud cost optimization tools for small businesses SMB FinOps pricing ease of use alternatives"
)

search_response = internet_search(
    query=query,
    max_results=8,
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
                    "Use ONLY the Tavily search results below as source material. "
                    "Do not rely on model memory. "
                    "Do not invent pricing, features, market share, dates, or claims. "
                    "Separate source-backed observations from strategic inferences. "
                    "Prefer cloud cost management, FinOps, cloud spend monitoring, rightsizing, "
                    "Kubernetes cost, AWS/Azure/GCP cost, and SMB-friendly tooling sources.\n\n"
                    "Return a structured strategy brief with these sections:\n"
                    "1. Market snapshot\n"
                    "2. Source-backed competitor capability patterns\n"
                    "3. Pricing / complexity signals found in sources\n"
                    "4. SMB pain points implied by sources\n"
                    "5. Five positioning opportunities for cloudless.gr\n"
                    "6. Risks / assumptions to validate next\n\n"
                    "Keep each section concise and practical. "
                    "For positioning opportunities, clearly label them as inferences.\n\n"
                    f"Research question: {query}\n\n"
                    f"Tavily search results:\n{formatted_sources}"
                ),
            }
        ]
    }
)

print("\n=== Strategy Brief ===\n")
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
