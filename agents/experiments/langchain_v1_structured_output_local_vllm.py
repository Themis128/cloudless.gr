"""LangChain v1 structured output experiment with local vLLM.

This version intentionally tests only ToolStrategy structured output.
It does not mix normal runtime tools with the structured-output tool, because
some local OpenAI-compatible models can keep cycling through tool calls and hit
LangGraph's recursion limit.

Run:
    cd ~/code/cloudless.gr
    source .venv/bin/activate
    PYTHONPATH=. python agents/experiments/langchain_v1_structured_output_local_vllm.py
"""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

load_dotenv(".env.local")

BASE_URL = os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1")
API_KEY = os.getenv("OPENAI_API_KEY", "dummy")
MODEL_NAME = os.getenv("LOCAL_LLM_MODEL", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ")


class ExperimentReport(BaseModel):
    """Structured report for the local LangChain v1 experiment."""

    status: str = Field(description="Use exactly: pass, needs_review, or fail")
    model: str = Field(description="Model used by the experiment")
    endpoint: str = Field(description="OpenAI-compatible endpoint used by the experiment")
    tool_result: int = Field(description="The deterministic arithmetic result 6 * 7")
    recommendation: str = Field(description="Short recommendation for the next step")


def build_agent() -> Any:
    model = ChatOpenAI(
        model=MODEL_NAME,
        base_url=BASE_URL,
        api_key=API_KEY,
        temperature=0,
        max_tokens=512,
        use_responses_api=False,
        stream_usage=False,
    )

    return create_agent(
        model=model,
        tools=[],
        response_format=ToolStrategy(
            ExperimentReport,
            tool_message_content="Structured experiment report captured.",
            handle_errors=True,
        ),
        system_prompt=(
            "You are a strict structured-output test agent. "
            "Return exactly one ExperimentReport. "
            "Do not call any ordinary tools. "
            "Do not produce repeated outputs."
        ),
    )


def main() -> None:
    print("=== LangChain v1 ToolStrategy structured output experiment ===")
    print(f"Model: {MODEL_NAME}")
    print(f"Base URL: {BASE_URL}")

    agent = build_agent()

    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": (
                        "Return one ExperimentReport with: "
                        "status='pass', "
                        f"model='{MODEL_NAME}', "
                        f"endpoint='{BASE_URL}', "
                        "tool_result=42, "
                        "recommendation='Keep this as an isolated structured-output smoke test before adding tools.'"
                    ),
                }
            ]
        },
        config={"recursion_limit": 6},
    )

    structured_response = result.get("structured_response")

    print("\n=== Structured response ===")
    if structured_response is None:
        print("No structured_response returned.")
    elif hasattr(structured_response, "model_dump"):
        print(structured_response.model_dump())
    else:
        print(structured_response)

    print("\n=== Deterministic validation ===")
    has_structured_response = structured_response is not None
    status_ok = getattr(structured_response, "status", None) == "pass"
    model_ok = getattr(structured_response, "model", None) == MODEL_NAME
    endpoint_ok = getattr(structured_response, "endpoint", None) == BASE_URL
    tool_result_ok = getattr(structured_response, "tool_result", None) == 42

    print("Has structured_response:", has_structured_response)
    print("status == pass:", status_ok)
    print("model matches:", model_ok)
    print("endpoint matches:", endpoint_ok)
    print("tool_result == 42:", tool_result_ok)

    print("\n=== Verdict ===")
    if all([has_structured_response, status_ok, model_ok, endpoint_ok, tool_result_ok]):
        print("PASS: ToolStrategy structured output worked with local vLLM.")
    else:
        print("NEEDS_REVIEW: Structured output did not fully match expected validation.")

    print("\n=== Message trace summary ===")
    for i, message in enumerate(result.get("messages", []), start=1):
        msg_type = getattr(message, "type", message.__class__.__name__)
        name = getattr(message, "name", None)
        content = getattr(message, "content", "")
        preview = str(content).replace("\n", " ")[:220]
        if name:
            print(f"{i}. {msg_type}({name}): {preview}")
        else:
            print(f"{i}. {msg_type}: {preview}")


if __name__ == "__main__":
    main()
