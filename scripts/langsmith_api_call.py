import argparse
import json
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


CLIENTS = {
    "langsmith": LangSmithClient,
    "deepagents": ManagedDeepAgentsClient,
    "agent-server": AgentServerClient,
    "fleet": FleetClient,
}


def parse_json(value):
    if not value:
        return None

    try:
        return json.loads(value)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON: {exc}") from exc


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generic LangSmith / Managed Deep Agents / Agent Server API caller"
    )
    parser.add_argument("client", choices=sorted(CLIENTS))
    parser.add_argument("method", choices=["GET", "POST", "PATCH", "PUT", "DELETE"])
    parser.add_argument("path")
    parser.add_argument("--params", help='JSON query params, e.g. \'{"limit":1}\'')
    parser.add_argument("--json", help='JSON request body, e.g. \'{"name":"test"}\'')
    parser.add_argument(
        "--allow-error",
        action="store_true",
        help="Print API errors but exit with code 0.",
    )

    argv = sys.argv[1:]
    if argv and argv[0] == "--":
        argv = argv[1:]

    args = parser.parse_args(argv)
    client = CLIENTS[args.client].from_env()

    try:
        response = client.request_api(
            args.method,
            args.path,
            params=parse_json(args.params),
            json_body=parse_json(args.json),
        )
    except LangSmithAPIError as exc:
        print(f"API error: HTTP {exc.status_code}", file=sys.stderr)
        print(json.dumps(exc.body, indent=2, ensure_ascii=False), file=sys.stderr)

        if args.allow_error:
            raise SystemExit(0) from exc

        raise SystemExit(1) from exc

    print(json.dumps(response.data, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
