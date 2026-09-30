from __future__ import annotations

from typing import Any

from .base import APIResponse, BaseAPIClient


class ManagedDeepAgentsClient(BaseAPIClient):
    """Client for LangSmith Managed Deep Agents API.

    Default base URL:
      https://api.smith.langchain.com/v1/deepagents
    """

    @classmethod
    def from_env(cls) -> ManagedDeepAgentsClient:
        import os

        return cls(
            base_url=os.getenv(
                "DEEPAGENTS_BASE_URL",
                "https://api.smith.langchain.com/v1/deepagents",
            ),
            api_key=os.getenv("LANGSMITH_API_KEY"),
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

    # -------------------------------------------------------------------------
    # Agents
    # -------------------------------------------------------------------------

    def list_agents(self, **params: Any) -> Any:
        return self.get("/agents", params=params).data

    def create_agent(self, payload: dict[str, Any]) -> Any:
        return self.post("/agents", json_body=payload).data

    def get_agent(self, agent_id: str) -> Any:
        return self.get(f"/agents/{agent_id}").data

    def update_agent(self, agent_id: str, payload: dict[str, Any]) -> Any:
        return self.patch(f"/agents/{agent_id}", json_body=payload).data

    def delete_agent(self, agent_id: str) -> Any:
        return self.delete(f"/agents/{agent_id}").data

    def clone_agent(self, agent_id: str, payload: dict[str, Any] | None = None) -> Any:
        return self.post(f"/agents/{agent_id}/clone", json_body=payload or {}).data

    def check_agent_health(self, agent_id: str) -> Any:
        return self.get(f"/agents/{agent_id}/health").data

    # -------------------------------------------------------------------------
    # Threads
    # -------------------------------------------------------------------------

    def list_threads(self, **params: Any) -> Any:
        return self.get("/threads", params=params).data

    def create_thread(self, payload: dict[str, Any]) -> Any:
        return self.post("/threads", json_body=payload).data

    def get_thread(self, thread_id: str) -> Any:
        return self.get(f"/threads/{thread_id}").data

    def update_thread(self, thread_id: str, payload: dict[str, Any]) -> Any:
        return self.patch(f"/threads/{thread_id}", json_body=payload).data

    def delete_thread(self, thread_id: str) -> Any:
        return self.delete(f"/threads/{thread_id}").data

    def search_threads(self, payload: dict[str, Any]) -> Any:
        return self.post("/threads/search", json_body=payload).data

    def count_threads(self, payload: dict[str, Any] | None = None) -> Any:
        return self.post("/threads/count", json_body=payload or {}).data

    # -------------------------------------------------------------------------
    # Runs
    # -------------------------------------------------------------------------

    def create_thread_run(self, thread_id: str, payload: dict[str, Any]) -> Any:
        return self.post(f"/threads/{thread_id}/runs", json_body=payload).data

    def create_thread_and_run(self, payload: dict[str, Any]) -> Any:
        return self.post("/threads/runs", json_body=payload).data

    def stream_thread_run(self, thread_id: str, payload: dict[str, Any]) -> Any:
        return self.post(f"/threads/{thread_id}/runs/stream", json_body=payload).data

    def resolve_interrupt(self, thread_id: str, run_id: str, payload: dict[str, Any]) -> Any:
        return self.post(
            f"/threads/{thread_id}/runs/{run_id}/interrupt",
            json_body=payload,
        ).data

    # -------------------------------------------------------------------------
    # MCP servers/tools
    # -------------------------------------------------------------------------

    def list_mcp_servers(self, **params: Any) -> Any:
        return self.get("/mcp-servers", params=params).data

    def create_mcp_server(self, payload: dict[str, Any]) -> Any:
        return self.post("/mcp-servers", json_body=payload).data

    def get_mcp_server(self, server_id: str) -> Any:
        return self.get(f"/mcp-servers/{server_id}").data

    def update_mcp_server(self, server_id: str, payload: dict[str, Any]) -> Any:
        return self.patch(f"/mcp-servers/{server_id}", json_body=payload).data

    def delete_mcp_server(self, server_id: str) -> Any:
        return self.delete(f"/mcp-servers/{server_id}").data

    def list_mcp_tools(self, server_id: str, **params: Any) -> Any:
        return self.get(f"/mcp-servers/{server_id}/tools", params=params).data

    def register_oauth_provider(self, server_id: str, payload: dict[str, Any]) -> Any:
        return self.post(f"/mcp-servers/{server_id}/oauth-provider", json_body=payload).data

    # -------------------------------------------------------------------------
    # Auth sessions
    # -------------------------------------------------------------------------

    def start_auth_session(self, payload: dict[str, Any]) -> Any:
        return self.post("/auth-sessions", json_body=payload).data

    def get_auth_session(self, session_id: str) -> Any:
        return self.get(f"/auth-sessions/{session_id}").data
