import os
from pathlib import Path

from dotenv import load_dotenv
from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI

from deepagents.backends import CompositeBackend, StateBackend
from deepagents.backends.filesystem import FilesystemBackend

from agents.tools.search import internet_search


load_dotenv(".env.local")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MEMORY_ROOT = PROJECT_ROOT / ".agent-memory"

research_instructions = """
You are an expert researcher and technical analyst for the cloudless.gr app.

Your job is to conduct thorough research, inspect relevant information, and write clear, polished reports.

You have access to an internet search tool as your primary means of gathering up-to-date information.

## internet_search

Use this to run an internet search for a given query.
You can specify:
- max_results
- topic: general, news, or finance
- whether raw content should be included

## Memory behavior

You have persistent memory available at /memories/AGENTS.md.

Use memory to remember stable, useful, non-secret preferences and project conventions.
You may update memory when the user explicitly asks you to remember something useful for future runs.
Never store secrets, API keys, tokens, passwords, private credentials, or sensitive personal data in memory.

## Research behavior

When search results are provided in the user message, use those search results as the primary source of truth.
For factual, technical, or current-information questions, do not answer from memory alone.
If search results are insufficient, say so.
Never invent organizations, ownership, URLs, dates, or unsupported claims.
"""

model = ChatOpenAI(
    model=os.getenv("LOCAL_MODEL_NAME", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ"),
    api_key=os.getenv("OPENAI_API_KEY", "dummy"),
    base_url=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1"),
    temperature=0,
    max_tokens=1024,
    use_responses_api=False,
    stream_usage=False,
    disabled_params={
        "parallel_tool_calls": None,
    },
)

agent = create_deep_agent(
    model=model,
    tools=[internet_search],
    system_prompt=research_instructions,
    memory=["/memories/AGENTS.md"],
    backend=CompositeBackend(
        default=StateBackend(),
        routes={
            "/memories/": FilesystemBackend(root_dir=str(MEMORY_ROOT), virtual_mode=True),
        },
    ),
)
