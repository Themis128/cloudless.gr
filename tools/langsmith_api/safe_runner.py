from __future__ import annotations

import os
from typing import Any, Dict, Optional

from .agent_server import AgentServerClient
from .base import LangSmithAPIError
from .endpoints import get_endpoint, list_endpoints
from .fleet import FleetClient
from .langsmith import LangSmithClient
from .managed_deepagents import ManagedDeepAgentsClient


CLIENTS = {
    "langsmith": LangSmithClient,
    "deepagents": ManagedDeepAgentsClient,
    "agent-server": AgentServerClient,
    "fleet": FleetClient,
}


SAFE_POST_SUFFIXES = (
    ".query",
    ".search",
)


def endpoint_is_safe_read(endpoint_name: str, endpoint: Dict[str, Any]) -> bool:
    """Allow only read-style endpoints.

    GET is considered read-only.
    POST is allowed only for registry names ending with .query or .search.
    """
    method = endpoint["method"].upper()

    if method == "GET":
        return True

    if method == "POST" and endpoint_name.endswith(SAFE_POST_SUFFIXES):
        return True

    return False


def run_registered_endpoint(
    endpoint_name: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    json_body: Optional[Dict[str, Any]] = None,
    page: Optional[bool] = None,
    page_size: int = 100,
    max_pages: int = 3,
) -> Dict[str, Any]:
    """Run a registered endpoint safely.

    Returns a structured dictionary instead of raising for expected auth/API errors.
    """
    try:
        endpoint = get_endpoint(endpoint_name)
    except KeyError as exc:
        return {
            "ok": False,
            "error": "unknown_endpoint",
            "detail": str(exc),
            "available": sorted(list_endpoints().keys()),
        }

    if not endpoint_is_safe_read(endpoint_name, endpoint):
        return {
            "ok": False,
            "error": "unsafe_endpoint",
            "detail": "Only GET endpoints and POST .query/.search endpoints are allowed.",
            "endpoint": endpoint_name,
        }

    if endpoint.get("auth_required") and not os.getenv("LANGSMITH_API_KEY"):
        return {
            "ok": False,
            "error": "missing_api_key",
            "detail": "Endpoint requires LANGSMITH_API_KEY, but it is not configured.",
            "endpoint": endpoint_name,
        }

    client = CLIENTS[endpoint["client"]].from_env()
    method = endpoint["method"].upper()
    path = endpoint["path"]
    use_pagination = endpoint.get("paginated") if page is None else page

    try:
        if use_pagination:
            if method == "GET":
                data = client.paginate_get(
                    path,
                    params=params,
                    page_size=page_size,
                    max_pages=max_pages,
                )
            elif method == "POST":
                data = client.paginate_post(
                    path,
                    json_body=json_body,
                    page_size=page_size,
                    max_pages=max_pages,
                )
            else:
                return {
                    "ok": False,
                    "error": "unsupported_pagination_method",
                    "method": method,
                    "endpoint": endpoint_name,
                }
        else:
            response = client.request_api(
                method,
                path,
                params=params,
                json_body=json_body,
            )
            data = response.data

        return {
            "ok": True,
            "endpoint": endpoint_name,
            "client": endpoint["client"],
            "method": method,
            "path": path,
            "data": data,
        }

    except LangSmithAPIError as exc:
        return {
            "ok": False,
            "error": "api_error",
            "status_code": exc.status_code,
            "body": exc.body,
            "endpoint": endpoint_name,
        }

    except Exception as exc:
        return {
            "ok": False,
            "error": "request_error",
            "detail": str(exc),
            "endpoint": endpoint_name,
        }
