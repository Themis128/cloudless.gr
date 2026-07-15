from __future__ import annotations

import json
from typing import Any, Dict, Iterable, Iterator, Optional


def _parse_data(raw_data: str) -> Any:
    raw_data = raw_data.strip()

    if raw_data == "[DONE]":
        return {"done": True}

    if not raw_data:
        return None

    try:
        return json.loads(raw_data)
    except json.JSONDecodeError:
        return raw_data


def iter_sse_events(lines: Iterable[str]) -> Iterator[Dict[str, Any]]:
    """Parse Server-Sent Events from an iterable of decoded lines.

    Supports common SSE fields:
      event:
      data:
      id:
      retry:

    Emits dictionaries:
      {
        "event": "updates",
        "data": {...},
        "raw_data": "...",
        "id": "...",
        "retry": "..."
      }
    """
    event_name: Optional[str] = None
    event_id: Optional[str] = None
    retry: Optional[str] = None
    data_lines: list[str] = []

    def emit() -> Optional[Dict[str, Any]]:
        nonlocal event_name, event_id, retry, data_lines

        if not event_name and not event_id and not retry and not data_lines:
            return None

        raw_data = "\n".join(data_lines)
        event = {
            "event": event_name or "message",
            "data": _parse_data(raw_data),
            "raw_data": raw_data,
        }

        if event_id is not None:
            event["id"] = event_id

        if retry is not None:
            event["retry"] = retry

        event_name = None
        event_id = None
        retry = None
        data_lines = []

        return event

    for line in lines:
        if line is None:
            continue

        # requests may still provide bytes if decode_unicode is not respected
        if isinstance(line, bytes):
            line = line.decode("utf-8", errors="replace")

        line = line.rstrip("\n")

        if line == "":
            event = emit()
            if event is not None:
                yield event
            continue

        if line.startswith(":"):
            # SSE comment / heartbeat
            continue

        field, sep, value = line.partition(":")
        if sep:
            value = value.lstrip(" ")

        if field == "event":
            event_name = value
        elif field == "data":
            data_lines.append(value)
        elif field == "id":
            event_id = value
        elif field == "retry":
            retry = value

    event = emit()
    if event is not None:
        yield event
