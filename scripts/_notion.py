"""Shared Notion API helpers for the scripts/notion-* family —
mirrors the bash HEADERS + curl behavior (NOTION_VERSION
2022-06-28, NOTION_API_KEY bearer)."""

import json
import os
import sys
import urllib.error
import urllib.request

API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def _key() -> str:
    key = os.environ.get("NOTION_API_KEY", "")
    if not key:
        sys.exit("NOTION_API_KEY is required")
    return key


def api(method: str, path: str,
        body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{API}{path}", method=method,
        data=json.dumps(body).encode() if body is not None
        else None,
        headers={
            "Authorization": f"Bearer {_key()}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json"})
    try:
        return json.loads(
            urllib.request.urlopen(req, timeout=30).read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"object": "error", "code": str(e.code)}
    except Exception as e:
        return {"object": "error", "code": "request_failed",
                "message": str(e)}


def title_of(page_or_db: dict) -> str:
    """Extract plain-text title from a page or database object."""
    for t in page_or_db.get("title", []):
        # databases carry title at top level
        pass
    if page_or_db.get("title"):
        return "".join(
            t.get("plain_text", "")
            for t in page_or_db["title"])
    for v in page_or_db.get("properties", {}).values():
        if v.get("type") == "title":
            return "".join(
                t.get("plain_text", "")
                for t in v.get("title", []))
    return ""


def prop_text(v: dict) -> str:
    """Flatten a Notion property value to a printable string."""
    t = v.get("type", "")
    if t == "title":
        return "".join(x.get("plain_text", "")
                       for x in v.get("title", []))
    if t == "rich_text":
        return "".join(x.get("plain_text", "")
                       for x in v.get("rich_text", []))
    if t == "select":
        return (v.get("select") or {}).get("name", "")
    if t == "checkbox":
        return str(v.get("checkbox", False))
    if t == "url":
        return v.get("url") or ""
    if t == "number":
        return str(v.get("number", ""))
    if t == "date":
        return (v.get("date") or {}).get("start", "")
    return ""


def block_children(page_id: str) -> list:
    return api(
        "GET",
        f"/blocks/{page_id}/children?page_size=100")\
        .get("results", [])


# Block constructors matching the originals.
def p(text):
    return {"object": "block", "type": "paragraph",
            "paragraph": {"rich_text":
                          [{"text": {"content": text}}]}}


def h1(text):
    return {"object": "block", "type": "heading_1",
            "heading_1": {"rich_text":
                          [{"text": {"content": text}}]}}


def h2(text):
    return {"object": "block", "type": "heading_2",
            "heading_2": {"rich_text":
                          [{"text": {"content": text}}]}}


def h3(text):
    return {"object": "block", "type": "heading_3",
            "heading_3": {"rich_text":
                          [{"text": {"content": text}}]}}


def bul(text):
    return {"object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {"rich_text":
                                   [{"text":
                                     {"content": text}}]}}


def todo(text, checked=False):
    return {"object": "block", "type": "to_do",
            "to_do": {"rich_text":
                      [{"text": {"content": text}}],
                      "checked": checked}}


def divider():
    return {"object": "block", "type": "divider",
            "divider": {}}


def code(text, lang="bash"):
    return {"object": "block", "type": "code",
            "code": {"rich_text":
                     [{"text": {"content": text}}],
                     "language": lang}}


def callout(text, emoji="⚠️"):
    return {"object": "block", "type": "callout",
            "callout": {"rich_text":
                        [{"text": {"content": text}}],
                        "icon": {"type": "emoji",
                                 "emoji": emoji}}}
