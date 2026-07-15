from tools.langsmith_api.streaming import iter_sse_events


def test_iter_sse_events_parses_named_events():
    lines = [
        "event: metadata",
        'data: {"run_id":"abc"}',
        "",
        "event: updates",
        'data: {"step":1}',
        "",
    ]

    events = list(iter_sse_events(lines))

    assert events == [
        {
            "event": "metadata",
            "data": {"run_id": "abc"},
            "raw_data": '{"run_id":"abc"}',
        },
        {
            "event": "updates",
            "data": {"step": 1},
            "raw_data": '{"step":1}',
        },
    ]


def test_iter_sse_events_parses_done():
    events = list(iter_sse_events(["data: [DONE]", ""]))

    assert events == [
        {
            "event": "message",
            "data": {"done": True},
            "raw_data": "[DONE]",
        }
    ]


def test_iter_sse_events_handles_plain_text():
    events = list(iter_sse_events(["event: message", "data: hello", ""]))

    assert events[0]["event"] == "message"
    assert events[0]["data"] == "hello"
