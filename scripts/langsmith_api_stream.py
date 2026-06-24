import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
from requests import RequestException

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


def print_event(event, *, raw=False):
    if raw:
        print(json.dumps(event, ensure_ascii=False))
        return

    print()
    print(f"[event] {event.get('event', 'message')}")

    data = event.get("data")
    if isinstance(data, (dict, list)):
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print(data)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Streaming LangSmith / Managed Deep Agents / Agent Server API caller"
    )
    parser.add_argument("client", choices=sorted(CLIENTS))
    parser.add_argument("method", choices=["GET", "POST", "PATCH", "PUT"])
    parser.add_argument("path")
    parser.add_argument("--params", help='JSON query params, e.g. \'{"limit":1}\'')
    parser.add_argument("--json", help='JSON body, e.g. \'{"input":{}}\'')
    parser.add_argument("--raw", action="store_true", help="Print raw JSONL events")
    parser.add_argument("--allow-error", action="store_true")

    argv = sys.argv[1:]
    if argv and argv[0] == "--":
        argv = argv[1:]

    args = parser.parse_args(argv)

    client = CLIENTS[args.client].from_env()

    try:
        count = 0
        for event in client.stream(
            args.method,
            args.path,
            params=parse_json(args.params),
            json_body=parse_json(args.json),
        ):
            count += 1
            print_event(event, raw=args.raw)

        if count == 0:
            print("No stream events received.")

    except LangSmithAPIError as exc:
        print(f"API error: HTTP {exc.status_code}", file=sys.stderr)
        print(json.dumps(exc.body, indent=2, ensure_ascii=False), file=sys.stderr)

        if args.allow_error:
            raise SystemExit(0) from exc

        raise SystemExit(1) from exc

    except RequestException as exc:
        print(f"Request error: {exc}", file=sys.stderr)

        if args.allow_error:
            raise SystemExit(0) from exc

        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
