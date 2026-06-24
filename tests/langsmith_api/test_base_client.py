from tools.langsmith_api.base import BaseAPIClient, LangSmithAPIError


def make_client():
    return BaseAPIClient(base_url="http://example.test", api_key="test")


def test_extract_items_from_list():
    client = make_client()
    assert client._extract_items([1, 2, 3]) == [1, 2, 3]


def test_extract_items_from_common_keys():
    client = make_client()
    assert client._extract_items({"items": [1]}) == [1]
    assert client._extract_items({"data": [2]}) == [2]
    assert client._extract_items({"agents": [3]}) == [3]


def test_extract_items_with_explicit_key():
    client = make_client()
    assert client._extract_items({"custom": ["x"]}, items_key="custom") == ["x"]


def test_next_cursor_top_level():
    client = make_client()
    assert client._next_cursor({"next_cursor": "abc"}) == "abc"
    assert client._next_cursor({"next_page_token": "def"}) == "def"


def test_next_cursor_nested_pagination():
    client = make_client()
    assert client._next_cursor({"pagination": {"next_cursor": "abc"}}) == "abc"


def test_api_error_properties():
    error = LangSmithAPIError(
        "failed",
        status_code=401,
        body={"detail": "Invalid token"},
        url="http://example.test",
    )

    assert error.status_code == 401
    assert error.body == {"detail": "Invalid token"}
    assert error.url == "http://example.test"
