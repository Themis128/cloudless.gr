from __future__ import annotations

import os
from collections.abc import Callable

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, wrap_model_call
from langchain.agents.middleware.types import ModelResponse
from langchain.tools import tool
from langchain_openai import ChatOpenAI

load_dotenv(".env.local")

BASE_URL = os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1")
API_KEY = os.getenv("OPENAI_API_KEY", "dummy")
MODEL_NAME = os.getenv("LOCAL_LLM_MODEL", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ")

MIDDLEWARE_EVENTS: list[dict] = []


@tool
def repo_profile() -> str:
    """Return a short profile of the local cloudless.gr agent setup."""
    return (
        "cloudless.gr local setup uses local vLLM, Qwen, LangChain v1, "
        "Deep Agents experiments, deterministic docs runners, Tavily research, "
        "and filesystem-backed memory."
    )


@tool
def multiply_numbers(a: int, b: int) -> int:
    """Multiply two integers."""
    return a * b


@wrap_model_call
def inspect_and_control_model_request(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """Inspect ModelRequest and override model settings before each model call."""

    model_settings = dict(request.model_settings or {})
    model_settings.setdefault("temperature", 0)
    model_settings.setdefault("max_tokens", 512)

    updated_request = request.override(model_settings=model_settings)

    event = {
        "model": getattr(request.model, "model_name", str(request.model)),
        "message_count": len(request.messages),
        "tool_count": len(request.tools or []),
        "tool_choice": request.tool_choice,
        "response_format": str(request.response_format),
        "before_model_settings": dict(request.model_settings or {}),
        "after_model_settings": dict(updated_request.model_settings or {}),
    }
    MIDDLEWARE_EVENTS.append(event)

    print("\n=== ModelRequest middleware ===")
    print("Model:", event["model"])
    print("Message count:", event["message_count"])
    print("Tool count:", event["tool_count"])
    print("Tool choice:", event["tool_choice"])
    print("Response format:", event["response_format"])
    print("Existing model_settings:", event["before_model_settings"])
    print("Updated model_settings:", event["after_model_settings"])

    return handler(updated_request)


def build_agent():
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
        tools=[repo_profile, multiply_numbers],
        middleware=[inspect_and_control_model_request],
        system_prompt=(
            "You are a concise local cloudless.gr LangChain v1 middleware "
            "experiment agent. Use each requested tool at most once. "
            "Do not repeat tool calls. Do not invent project facts."
        ),
    )


def main() -> None:
    print("=== LangChain v1 ModelRequest middleware experiment ===")
    print(f"Model: {MODEL_NAME}")
    print(f"Base URL: {BASE_URL}")

    agent = build_agent()

    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": (
                        "Call repo_profile exactly once. "
                        "Call multiply_numbers exactly once with a=6 and b=7. "
                        "Then stop and give a short final answer."
                    ),
                }
            ]
        },
        config={"recursion_limit": 6},
    )

    print("\n=== Final model message ===")
    final_message = result["messages"][-1]
    print(getattr(final_message, "content", final_message))

    print("\n=== Deterministic middleware validation ===")
    middleware_ran = len(MIDDLEWARE_EVENTS) > 0
    settings_overridden = any(
        event["after_model_settings"].get("temperature") == 0
        and event["after_model_settings"].get("max_tokens") == 512
        for event in MIDDLEWARE_EVENTS
    )
    saw_two_tools = any(event["tool_count"] == 2 for event in MIDDLEWARE_EVENTS)

    print("Middleware call count:", len(MIDDLEWARE_EVENTS))
    print("Middleware ran:", middleware_ran)
    print("Saw 2 tools in ModelRequest:", saw_two_tools)
    print("Overrode model_settings:", settings_overridden)

    tool_messages = [
        message for message in result.get("messages", [])
        if getattr(message, "type", None) == "tool"
    ]

    print("Tool message count:", len(tool_messages))
    for i, message in enumerate(tool_messages, start=1):
        content = str(getattr(message, "content", "")).replace("\n", " ")[:200]
        print(f"Tool {i}: {content}")

    print("\n=== Verdict ===")
    if middleware_ran and settings_overridden and saw_two_tools:
        print("PASS: ModelRequest middleware worked. Python-side logs confirm it.")
    else:
        print("FAIL: Middleware validation did not pass.")

    print("\n=== Message trace summary ===")
    for i, message in enumerate(result.get("messages", []), start=1):
        msg_type = getattr(message, "type", message.__class__.__name__)
        content = getattr(message, "content", "")
        preview = str(content).replace("\n", " ")[:180]
        print(f"{i}. {msg_type}: {preview}")


if __name__ == "__main__":
    main()
