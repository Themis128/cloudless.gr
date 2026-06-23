"""Minimal LangChain v1 create_agent experiment with local vLLM.

Purpose:
    Test LangChain v1 `create_agent` against the local OpenAI-compatible vLLM
    server already used by cloudless.gr.

Run from repo root:
    cd ~/code/cloudless.gr
    source .venv/bin/activate
    PYTHONPATH=. python agents/experiments/langchain_v1_create_agent_local_vllm.py

Prerequisites:
    - vLLM running at http://127.0.0.1:8001/v1
    - .env.local may optionally define:
        OPENAI_BASE_URL=http://127.0.0.1:8001/v1
        OPENAI_API_KEY=dummy
        LOCAL_LLM_MODEL=Qwen/Qwen2.5-Coder-3B-Instruct-AWQ
"""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI

load_dotenv(".env.local")

BASE_URL = os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1")
API_KEY = os.getenv("OPENAI_API_KEY", "dummy")
MODEL_NAME = os.getenv("LOCAL_LLM_MODEL", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ")


@tool
def repo_profile() -> str:
    """Return a short profile of the local cloudless.gr agent setup."""
    return (
        "cloudless.gr local agent setup: local vLLM OpenAI-compatible endpoint, "
        "Qwen coder model, deterministic Tavily research runner, deterministic "
        "LangChain docs runners, and filesystem-backed memory."
    )


@tool
def add_numbers(a: int, b: int) -> int:
    """Add two integers and return the result."""
    return a + b


def build_agent() -> Any:
    """Build a small LangChain v1 agent using the local vLLM server."""
    model = ChatOpenAI(
        model=MODEL_NAME,
        base_url=BASE_URL,
        api_key=API_KEY,
        temperature=0,
        max_tokens=512,
        # Keep compatibility with vLLM/OpenAI-compatible chat completions.
        # Do not use Responses API for this local server.
        use_responses_api=False,
        stream_usage=False,
    )

    return create_agent(
        model=model,
        tools=[repo_profile, add_numbers],
        system_prompt=(
            "You are a concise local cloudless.gr experiment agent. "
            "Use tools when they are helpful. "
            "Do not invent project facts."
        ),
    )


def main() -> None:
    print("=== LangChain v1 create_agent local vLLM experiment ===")
    print(f"Model: {MODEL_NAME}")
    print(f"Base URL: {BASE_URL}")
    print()

    agent = build_agent()

    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": (
                        "Use the repo_profile tool, then add 21 and 21 with the "
                        "add_numbers tool. Finish with 3 concise bullets about "
                        "whether this create_agent experiment is working."
                    ),
                }
            ]
        }
    )

    print("=== Raw final message ===")
    final_message = result["messages"][-1]
    print(getattr(final_message, "content", final_message))

    print("\n=== Message trace summary ===")
    for i, message in enumerate(result.get("messages", []), start=1):
        msg_type = getattr(message, "type", message.__class__.__name__)
        content = getattr(message, "content", "")
        content_preview = str(content).replace("\n", " ")[:180]
        print(f"{i}. {msg_type}: {content_preview}")


if __name__ == "__main__":
    main()
