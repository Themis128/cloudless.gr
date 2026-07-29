from tools.langsmith_api.endpoints import get_endpoint, list_endpoints


def test_endpoint_registry_contains_health():
    registry = list_endpoints()
    assert "langsmith.health" in registry


def test_get_endpoint_health():
    endpoint = get_endpoint("langsmith.health")

    assert endpoint["client"] == "langsmith"
    assert endpoint["method"] == "GET"
    assert endpoint["path"] == "/info/health"
    assert endpoint["auth_required"] is False


def test_get_endpoint_unknown_raises_key_error():
    try:
        get_endpoint("missing.endpoint")
    except KeyError as exc:
        assert "Unknown endpoint" in str(exc)
    else:
        raise AssertionError("Expected KeyError")


def test_endpoint_auth_flags_for_public_and_protected_examples():
    health = get_endpoint("langsmith.health")
    fleet = get_endpoint("fleet.connections.list")

    assert health["auth_required"] is False
    assert fleet["auth_required"] is True
