from __future__ import annotations

from typing import Any

from .base import APIResponse, BaseAPIClient


class LangSmithClient(BaseAPIClient):
    """Client for LangSmith Platform REST API.

    Default base URL:
      https://api.smith.langchain.com/api/v1
    """

    @classmethod
    def from_env(cls) -> LangSmithClient:
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

    # -------------------------------------------------------------------------
    # System / health
    # -------------------------------------------------------------------------

    def health(self) -> Any:
        return self.get("/info/health").data

    def server_info(self) -> Any:
        return self.get("/info").data

    # -------------------------------------------------------------------------
    # Workspaces
    # -------------------------------------------------------------------------

    def list_workspaces(self, **params: Any) -> Any:
        return self.get("/workspaces", params=params).data

    def create_workspace(self, payload: dict[str, Any]) -> Any:
        return self.post("/workspaces", json_body=payload).data

    def get_current_workspace_stats(self) -> Any:
        return self.get("/workspaces/current/stats").data

    def list_current_workspace_members(self, **params: Any) -> Any:
        return self.get("/workspaces/current/members", params=params).data

    # -------------------------------------------------------------------------
    # Organizations
    # -------------------------------------------------------------------------

    def get_current_org(self) -> Any:
        return self.get("/orgs/current").data

    def list_orgs(self, **params: Any) -> Any:
        return self.get("/orgs", params=params).data

    def get_current_org_members(self, **params: Any) -> Any:
        return self.get("/orgs/current/members", params=params).data

    # -------------------------------------------------------------------------
    # Tracing projects / tracer sessions
    # -------------------------------------------------------------------------

    def list_projects(self, **params: Any) -> Any:
        return self.get("/sessions", params=params).data

    def create_project(self, payload: dict[str, Any]) -> Any:
        return self.post("/sessions", json_body=payload).data

    def get_project(self, project_id: str) -> Any:
        return self.get(f"/sessions/{project_id}").data

    def update_project(self, project_id: str, payload: dict[str, Any]) -> Any:
        return self.patch(f"/sessions/{project_id}", json_body=payload).data

    def delete_project(self, project_id: str) -> Any:
        return self.delete(f"/sessions/{project_id}").data

    # -------------------------------------------------------------------------
    # Runs / traces
    # -------------------------------------------------------------------------

    def query_runs(self, payload: dict[str, Any]) -> Any:
        return self.post("/runs/query", json_body=payload).data

    def read_run(self, run_id: str) -> Any:
        return self.get(f"/runs/{run_id}").data

    def update_run(self, run_id: str, payload: dict[str, Any]) -> Any:
        return self.patch(f"/runs/{run_id}", json_body=payload).data

    def delete_runs(self, payload: dict[str, Any]) -> Any:
        return self.post("/runs/delete", json_body=payload).data

    # -------------------------------------------------------------------------
    # Datasets / examples
    # -------------------------------------------------------------------------

    def list_datasets(self, **params: Any) -> Any:
        return self.get("/datasets", params=params).data

    def create_dataset(self, payload: dict[str, Any]) -> Any:
        return self.post("/datasets", json_body=payload).data

    def read_dataset(self, dataset_id: str) -> Any:
        return self.get(f"/datasets/{dataset_id}").data

    def update_dataset(self, dataset_id: str, payload: dict[str, Any]) -> Any:
        return self.patch(f"/datasets/{dataset_id}", json_body=payload).data

    def delete_dataset(self, dataset_id: str) -> Any:
        return self.delete(f"/datasets/{dataset_id}").data

    def list_examples(self, **params: Any) -> Any:
        return self.get("/examples", params=params).data

    def create_example(self, payload: dict[str, Any]) -> Any:
        return self.post("/examples", json_body=payload).data

    # -------------------------------------------------------------------------
    # Feedback
    # -------------------------------------------------------------------------

    def list_feedback(self, **params: Any) -> Any:
        return self.get("/feedback", params=params).data

    def create_feedback(self, payload: dict[str, Any]) -> Any:
        return self.post("/feedback", json_body=payload).data

    def read_feedback(self, feedback_id: str) -> Any:
        return self.get(f"/feedback/{feedback_id}").data

    def update_feedback(self, feedback_id: str, payload: dict[str, Any]) -> Any:
        return self.patch(f"/feedback/{feedback_id}", json_body=payload).data

    def delete_feedback(self, feedback_id: str) -> Any:
        return self.delete(f"/feedback/{feedback_id}").data

    # -------------------------------------------------------------------------
    # Annotation queues
    # -------------------------------------------------------------------------

    def list_annotation_queues(self, **params: Any) -> Any:
        return self.get("/annotation-queues", params=params).data

    def create_annotation_queue(self, payload: dict[str, Any]) -> Any:
        return self.post("/annotation-queues", json_body=payload).data

    def get_annotation_queue(self, queue_id: str) -> Any:
        return self.get(f"/annotation-queues/{queue_id}").data

    def update_annotation_queue(self, queue_id: str, payload: dict[str, Any]) -> Any:
        return self.patch(f"/annotation-queues/{queue_id}", json_body=payload).data

    def delete_annotation_queue(self, queue_id: str) -> Any:
        return self.delete(f"/annotation-queues/{queue_id}").data
