from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional

import requests


class LangSmithAPIError(RuntimeError):
    """Raised when a LangSmith-compatible API returns an error."""

    def __init__(
        self,
        message: str,
        *,
        status_code: Optional[int] = None,
        body: Any = None,
        url: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body
        self.url = url


@dataclass
class APIResponse:
    status_code: int
    data: Any
    headers: Mapping[str, str]


class BaseAPIClient:
    """Small REST client for LangSmith-compatible APIs."""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.session = requests.Session()
        self.extra_headers = extra_headers or {}

    @classmethod
    def from_env(
        cls,
        *,
        base_url_env: str,
        default_base_url: str,
        api_key_env: str = "LANGSMITH_API_KEY",
        timeout: float = 30.0,
    ) -> "BaseAPIClient":
        return cls(
            base_url=os.getenv(base_url_env, default_base_url),
            api_key=os.getenv(api_key_env),
            timeout=timeout,
        )

    def _headers(self, headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        merged = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        if self.api_key:
            merged["X-Api-Key"] = self.api_key

        merged.update(self.extra_headers)

        if headers:
            merged.update(headers)

        return merged

    def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        raw: bool = False,
    ) -> APIResponse:
        url = f"{self.base_url}/{path.lstrip('/')}"

        response = self.session.request(
            method=method.upper(),
            url=url,
            params=params,
            json=json_body,
            headers=self._headers(headers),
            timeout=self.timeout,
        )

        content_type = response.headers.get("content-type", "")

        if raw:
            data: Any = response.content
        elif "application/json" in content_type:
            try:
                data = response.json()
            except json.JSONDecodeError:
                data = response.text
        else:
            data = response.text

        if response.status_code >= 400:
            raise LangSmithAPIError(
                f"{method.upper()} {url} failed with HTTP {response.status_code}",
                status_code=response.status_code,
                body=data,
                url=url,
            )

        return APIResponse(
            status_code=response.status_code,
            data=data,
            headers=response.headers,
        )

    def get(self, path: str, **kwargs: Any) -> APIResponse:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> APIResponse:
        return self.request("POST", path, **kwargs)

    def patch(self, path: str, **kwargs: Any) -> APIResponse:
        return self.request("PATCH", path, **kwargs)

    def put(self, path: str, **kwargs: Any) -> APIResponse:
        return self.request("PUT", path, **kwargs)

    def delete(self, path: str, **kwargs: Any) -> APIResponse:
        return self.request("DELETE", path, **kwargs)

    def _extract_items(self, data: Any, items_key: Optional[str] = None) -> list[Any]:
        """Extract list items from common API response shapes."""
        if isinstance(data, list):
            return data

        if not isinstance(data, dict):
            return []

        if items_key and isinstance(data.get(items_key), list):
            return data[items_key]

        for key in (
            "items",
            "data",
            "results",
            "runs",
            "examples",
            "datasets",
            "agents",
            "threads",
            "workspaces",
            "annotation_queues",
            "annotation-queues",
        ):
            value = data.get(key)
            if isinstance(value, list):
                return value

        return []

    def _next_cursor(self, data: Any) -> Optional[str]:
        """Extract next cursor/token from common paginated response shapes."""
        if not isinstance(data, dict):
            return None

        for key in (
            "next",
            "next_cursor",
            "next_page_token",
            "cursor",
            "next_token",
        ):
            value = data.get(key)
            if isinstance(value, str) and value:
                return value

        pagination = data.get("pagination")
        if isinstance(pagination, dict):
            for key in (
                "next",
                "next_cursor",
                "next_page_token",
                "cursor",
                "next_token",
            ):
                value = pagination.get(key)
                if isinstance(value, str) and value:
                    return value

        return None

    def paginate_get(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        items_key: Optional[str] = None,
        limit_param: str = "limit",
        cursor_param: str = "cursor",
        page_size: int = 100,
        max_pages: int = 10,
    ) -> list[Any]:
        """Collect items from a cursor-style GET endpoint."""
        output: list[Any] = []
        current_params = dict(params or {})
        current_params.setdefault(limit_param, page_size)

        cursor: Optional[str] = None

        for _ in range(max_pages):
            if cursor:
                current_params[cursor_param] = cursor

            response = self.get(path, params=current_params)
            data = response.data

            output.extend(self._extract_items(data, items_key=items_key))

            cursor = self._next_cursor(data)
            if not cursor:
                break

        return output

    def paginate_post(
        self,
        path: str,
        *,
        json_body: Optional[Dict[str, Any]] = None,
        items_key: Optional[str] = None,
        limit_key: str = "limit",
        cursor_key: str = "cursor",
        page_size: int = 100,
        max_pages: int = 10,
    ) -> list[Any]:
        """Collect items from a cursor-style POST endpoint."""
        output: list[Any] = []
        body = dict(json_body or {})
        body.setdefault(limit_key, page_size)

        cursor: Optional[str] = None

        for _ in range(max_pages):
            if cursor:
                body[cursor_key] = cursor

            response = self.post(path, json_body=body)
            data = response.data

            output.extend(self._extract_items(data, items_key=items_key))

            cursor = self._next_cursor(data)
            if not cursor:
                break

        return output
