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
        description="Paginated LangSmith / Managed Deep Agents / Agent Server API caller"
    )
    parser.add_argument("client", choices=sorted(CLIENTS))
    parser.add_argument("method", choices=["GET", "POST"])
    parser.add_argument("path")
    parser.add_argument("--params", help="JSON query params for GET, e.g. '{\"limit\":5}'")
    parser.add_argument("--json", help="JSON body for POST, e.g. '{\"limit\":5}'")
    parser.add_argument("--items-key", help="Response key containing list items")
    parser.add_argument("--page-size", type=int, default=100)
    parser.add_argument("--max-pages", type=int, default=10)
    parser.add_argument("--allow-error", action="store_true")

    argv = sys.argv[1:]
    if argv and argv[0] == "--":
        argv = argv[1:]

    args = parser.parse_args(argv)

    client = CLIENTS[args.client].from_env()

    try:
        if args.method == "GET":
            items = client.paginate_get(
                args.path,
                params=parse_json(args.params),
                items_key=args.items_key,
                page_size=args.page_size,
                max_pages=args.max_pages,
            )
        else:
            items = client.paginate_post(
                args.path,
                json_body=parse_json(args.json),
                items_key=args.items_key,
                page_size=args.page_size,
                max_pages=args.max_pages,
            )
    except LangSmithAPIError as exc:
        print(f"API error: HTTP {exc.status_code}", file=sys.stderr)
        print(json.dumps(exc.body, indent=2, ensure_ascii=False), file=sys.stderr)

        if args.allow_error:
            raise SystemExit(0) from exc

        raise SystemExit(1) from exc

    print(json.dumps(items, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
