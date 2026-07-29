from __future__ import annotations

from typing import Any

from .base import APIResponse, BaseAPIClient


class FleetClient(BaseAPIClient):
    """Client for Fleet/Auth/connection-style LangSmith APIs.

    Default points to LangSmith platform API base.
    """

    @classmethod
    def from_env(cls) -> FleetClient:
        import os

        return cls(
            base_url=os.getenv(
                "LANGSMITH_API_BASE_URL",
                "https://api.smith.langchain.com/api/v1",
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

    # Connections
    def create_connection(self, payload: dict[str, Any]) -> Any:
        return self.post("/agent-connections", json_body=payload).data

    def list_connections(self, **params: Any) -> Any:
        return self.get("/agent-connections", params=params).data

    def remove_connection(self, connection_id: str) -> Any:
        return self.delete(f"/agent-connections/{connection_id}").data

    # OAuth providers
    def list_oauth_providers(self, **params: Any) -> Any:
        return self.get("/oauth/providers", params=params).data

    def create_oauth_provider(self, payload: dict[str, Any]) -> Any:
        return self.post("/oauth/providers", json_body=payload).data

    def get_oauth_provider(self, provider_id: str) -> Any:
        return self.get(f"/oauth/providers/{provider_id}").data

    def update_oauth_provider(self, provider_id: str, payload: dict[str, Any]) -> Any:
        return self.patch(f"/oauth/providers/{provider_id}", json_body=payload).data

    def delete_oauth_provider(self, provider_id: str) -> Any:
        return self.delete(f"/oauth/providers/{provider_id}").data

    # OAuth tokens
    def list_oauth_tokens_for_user(self, user_id: str, **params: Any) -> Any:
        return self.get(f"/oauth/tokens/users/{user_id}", params=params).data

    def delete_oauth_tokens_for_user(self, user_id: str) -> Any:
        return self.delete(f"/oauth/tokens/users/{user_id}").data

    def delete_single_oauth_token(self, token_id: str) -> Any:
        return self.delete(f"/oauth/tokens/{token_id}").data
