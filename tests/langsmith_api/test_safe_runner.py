from tools.langsmith_api.endpoints import get_endpoint
from tools.langsmith_api.safe_runner import endpoint_is_safe_read, run_registered_endpoint


def test_health_endpoint_is_safe_get():
    endpoint = get_endpoint("langsmith.health")
    assert endpoint_is_safe_read("langsmith.health", endpoint) is True


def test_runs_query_post_is_safe():
    endpoint = get_endpoint("langsmith.runs.query")
    assert endpoint_is_safe_read("langsmith.runs.query", endpoint) is True


def test_unknown_endpoint_returns_structured_error():
    result = run_registered_endpoint("missing.endpoint")

    assert result["ok"] is False
    assert result["error"] == "unknown_endpoint"
    assert "available" in result


def test_auth_required_without_key_returns_missing_key(monkeypatch):
    monkeypatch.delenv("LANGSMITH_API_KEY", raising=False)

    result = run_registered_endpoint("langsmith.datasets.list")

    assert result["ok"] is False
    assert result["error"] == "missing_api_key"
