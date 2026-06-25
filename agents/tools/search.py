import os
from typing import Literal

from dotenv import load_dotenv
from langchain_tavily import TavilySearch

load_dotenv(".env.local")


def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search using Tavily."""
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        raise RuntimeError(
            "TAVILY_API_KEY is not set. Add it to .env.local or export it in your shell."
        )
    tool = TavilySearch(
        max_results=max_results,
        topic=topic,
        include_raw_content=include_raw_content,
        tavily_api_key=api_key,
    )
    return tool.invoke(query)
