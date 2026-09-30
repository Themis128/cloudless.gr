import argparse
import json
import os
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
from tools.langsmith_api.endpoints import get_endpoint, list_endpoints

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


def print_endpoint_list() -> None:
    registry = list_endpoints()

    for name in sorted(registry):
        item = registry[name]
        auth = "auth" if item.get("auth_required") else "public"
        page = "paginated" if item.get("paginated") else "single"
        print(f"{name} [{item['client']} {item['method']} {item['path']}] {auth}, {page}")
        print(f"  {item.get('description', '')}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Call a registered LangSmith API endpoint")
    parser.add_argument("endpoint", nargs="?", help="Endpoint name, e.g. langsmith.health")
    parser.add_argument("--list", action="store_true", help="List registered endpoints")
    parser.add_argument("--params", help="JSON query params, e.g. '{\"limit\":5}'")
    parser.add_argument("--json", help="JSON request body, e.g. '{\"limit\":5}'")
    parser.add_argument("--page", action="store_true", help="Use pagination helper if supported")
    parser.add_argument("--items-key", help="Response key containing list items")
    parser.add_argument("--page-size", type=int, default=100)
    parser.add_argument("--max-pages", type=int, default=10)
    parser.add_argument("--allow-error", action="store_true")

    argv = sys.argv[1:]
    if argv and argv[0] == "--":
        argv = argv[1:]

    args = parser.parse_args(argv)

    if args.list:
        print_endpoint_list()
        return

    if not args.endpoint:
        raise SystemExit("Missing endpoint name. Use --list to show available endpoints.")

    endpoint = get_endpoint(args.endpoint)

    if endpoint.get("auth_required") and not os.getenv("LANGSMITH_API_KEY"):
        print("Endpoint requires LANGSMITH_API_KEY, but it is not configured.", file=sys.stderr)
        if args.allow_error:
            raise SystemExit(0)
        raise SystemExit(1)

    client = CLIENTS[endpoint["client"]].from_env()
    method = endpoint["method"]
    path = endpoint["path"]

    try:
        if args.page or endpoint.get("paginated"):
            if method == "GET":
                data = client.paginate_get(
                    path,
                    params=parse_json(args.params),
                    items_key=args.items_key,
                    page_size=args.page_size,
                    max_pages=args.max_pages,
                )
            elif method == "POST":
                data = client.paginate_post(
                    path,
                    json_body=parse_json(args.json),
                    items_key=args.items_key,
                    page_size=args.page_size,
                    max_pages=args.max_pages,
                )
            else:
                raise SystemExit(f"Pagination is not supported for method {method}")
        else:
            response = client.request_api(
                method,
                path,
                params=parse_json(args.params),
                json_body=parse_json(args.json),
            )
            data = response.data

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

    print(json.dumps(data, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
