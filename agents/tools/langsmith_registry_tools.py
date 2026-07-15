from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

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


def list_langsmith_endpoints() -> str:
    """List registered, allow-listed LangSmith-related endpoints."""
    registry = list_endpoints()
    return json.dumps(registry, indent=2)


def describe_langsmith_endpoint(name: str) -> str:
    """Describe one registered LangSmith endpoint."""
    try:
        endpoint = get_endpoint(name)
    except KeyError as exc:
        return str(exc)

    return json.dumps(endpoint, indent=2)


def call_registered_langsmith_endpoint(
    name: str,
    params_json: Optional[str] = None,
    body_json: Optional[str] = None,
    max_pages: int = 1,
) -> str:
    """Call a registered endpoint only. Protected endpoints require LANGSMITH_API_KEY."""
    try:
        endpoint = get_endpoint(name)
    except KeyError as exc:
        return str(exc)

    if endpoint.get("auth_required") and not os.getenv("LANGSMITH_API_KEY"):
        return "Blocked: endpoint requires LANGSMITH_API_KEY, but it is not configured."

    params: Optional[Dict[str, Any]] = json.loads(params_json) if params_json else None
    body: Optional[Dict[str, Any]] = json.loads(body_json) if body_json else None

    client = CLIENTS[endpoint["client"]].from_env()
    method = endpoint["method"]
    path = endpoint["path"]

    try:
        if endpoint.get("paginated"):
            if method == "GET":
                data = client.paginate_get(path, params=params, max_pages=max_pages)
            elif method == "POST":
                data = client.paginate_post(path, json_body=body, max_pages=max_pages)
            else:
                return f"Pagination not supported for method {method}"
        else:
            response = client.request_api(method, path, params=params, json_body=body)
            data = response.data

    except LangSmithAPIError as exc:
        return json.dumps(
            {
                "error": "LangSmithAPIError",
                "status_code": exc.status_code,
                "body": exc.body,
            },
            indent=2,
        )
    except Exception as exc:
        return json.dumps(
            {
                "error": type(exc).__name__,
                "message": str(exc),
            },
            indent=2,
        )

    return json.dumps(data, indent=2, ensure_ascii=False)
