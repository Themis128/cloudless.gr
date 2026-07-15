import os
import sys
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

load_dotenv(".env.local")

from tools.langsmith_api import (
    AgentServerClient,
    FleetClient,
    LangSmithAPIError,
    LangSmithClient,
    ManagedDeepAgentsClient,
)


def show_data(data):
    if isinstance(data, dict):
        print("Keys:", ", ".join(list(data.keys())[:10]))
    elif isinstance(data, list):
        print(f"List length: {len(data)}")
    else:
        print(type(data).__name__)


def run_check(name, fn, *, requires_key=False, optional=False):
    print(f"\nChecking: {name}")

    if requires_key and not os.getenv("LANGSMITH_API_KEY"):
        print("SKIPPED: LANGSMITH_API_KEY is not configured")
        return

    try:
        data = fn()
        print("OK")
        show_data(data)
    except LangSmithAPIError as exc:
        label = "Optional API error" if optional else "API error"
        print(f"{label}: HTTP {exc.status_code}")
        print("Body:", str(exc.body)[:300])
    except Exception as exc:
        label = "Optional check unavailable" if optional else "Failed"
        print(f"{label}: {exc}")


def main():
    print("LangSmith API clients check")
    print("=" * 40)

    print("LANGSMITH_API_KEY configured:", "yes" if os.getenv("LANGSMITH_API_KEY") else "no")
    print(
        "LANGSMITH_API_BASE_URL:",
        os.getenv("LANGSMITH_API_BASE_URL", "https://api.smith.langchain.com/api/v1"),
    )
    print(
        "DEEPAGENTS_BASE_URL:",
        os.getenv("DEEPAGENTS_BASE_URL", "https://api.smith.langchain.com/v1/deepagents"),
    )
    print(
        "AGENT_SERVER_BASE_URL:",
        os.getenv("AGENT_SERVER_BASE_URL", "http://localhost:2024"),
    )

    run_check(
        "LangSmith health",
        lambda: LangSmithClient.from_env().health(),
    )

    run_check(
        "LangSmith workspaces",
        lambda: LangSmithClient.from_env().list_workspaces(limit=1),
        requires_key=True,
    )

    run_check(
        "Managed Deep Agents list_agents",
        lambda: ManagedDeepAgentsClient.from_env().list_agents(limit=1),
        requires_key=True,
    )

    run_check(
        "Fleet list_connections",
        lambda: FleetClient.from_env().list_connections(limit=1),
        requires_key=True,
        optional=True,
    )

    run_check(
        "Optional Agent Server health",
        lambda: AgentServerClient.from_env().health(),
        optional=True,
    )


if __name__ == "__main__":
    main()
