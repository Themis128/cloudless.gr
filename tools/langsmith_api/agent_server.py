from __future__ import annotations

import os
from typing import Any

from .base import APIResponse, BaseAPIClient


class AgentServerClient(BaseAPIClient):
    """Generic client for a LangGraph/LangSmith Agent Server.

    Configure:
      AGENT_SERVER_BASE_URL=http://localhost:2024
      AGENT_SERVER_API_KEY=optional
    """

    @classmethod
    def from_env(cls) -> AgentServerClient:
        return cls(
            base_url=os.getenv("AGENT_SERVER_BASE_URL", "http://localhost:2024"),
            api_key=os.getenv("AGENT_SERVER_API_KEY"),
        )

    def request_api(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: Any | None = None,
    ) -> APIResponse:
        return self.request(method, path, params=params, json_body=json_body)

    # System
    def health(self) -> Any:
        return self.get("/health").data

    def info(self) -> Any:
        return self.get("/info").data

    # Assistants
    def search_assistants(self, payload: dict[str, Any] | None = None) -> Any:
        return self.post("/assistants/search", json_body=payload or {}).data

    def create_assistant(self, payload: dict[str, Any]) -> Any:
        return self.post("/assistants", json_body=payload).data

    def get_assistant(self, assistant_id: str) -> Any:
        return self.get(f"/assistants/{assistant_id}").data

    def patch_assistant(self, assistant_id: str, payload: dict[str, Any]) -> Any:
        return self.patch(f"/assistants/{assistant_id}", json_body=payload).data

    def delete_assistant(self, assistant_id: str) -> Any:
        return self.delete(f"/assistants/{assistant_id}").data

    # Threads
    def create_thread(self, payload: dict[str, Any] | None = None) -> Any:
        return self.post("/threads", json_body=payload or {}).data

    def get_thread(self, thread_id: str) -> Any:
        return self.get(f"/threads/{thread_id}").data

    def search_threads(self, payload: dict[str, Any] | None = None) -> Any:
        return self.post("/threads/search", json_body=payload or {}).data

    def delete_thread(self, thread_id: str) -> Any:
        return self.delete(f"/threads/{thread_id}").data

    # Runs
    def create_thread_run(self, thread_id: str, payload: dict[str, Any]) -> Any:
        return self.post(f"/threads/{thread_id}/runs", json_body=payload).data

    def create_thread_run_stream(self, thread_id: str, payload: dict[str, Any]) -> Any:
        return self.post(f"/threads/{thread_id}/runs/stream", json_body=payload).data

    def get_run(self, thread_id: str, run_id: str) -> Any:
        return self.get(f"/threads/{thread_id}/runs/{run_id}").data

    def cancel_run(self, thread_id: str, run_id: str) -> Any:
        return self.post(f"/threads/{thread_id}/runs/{run_id}/cancel").data
