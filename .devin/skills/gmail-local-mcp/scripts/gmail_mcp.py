#!/usr/bin/env python3
"""gmail-local — stdio MCP server for baltzakis.themis@gmail.com.

Drop-in replacement for the org-level `gmail` MCP (gmailmcp.googleapis.com)
which currently fails with "Auth required" — no OAuth token is stored for
it. This server uses the LOCAL tokens instead:

  read  : %APPDATA%/devin/secrets/gmail-token.json      (gmail.readonly)
  send  : %APPDATA%/devin/secrets/gmail-send-token.json (gmail.modify)

Both refresh via ~/.config/google-calendar-mcp/gcp-oauth.keys.json.

Tools: gmail_search, gmail_read_thread, gmail_read_message, gmail_send,
gmail_list_drafts, gmail_create_draft.

Protocol: MCP stdio — newline-delimited JSON-RPC 2.0.
"""

import base64
import email.header
import email.mime.text
import email.utils
import json
import os
import sys
import time
import urllib.parse
import urllib.request

KEYS = os.path.join(os.environ.get("APPDATA", ""), "devin", "secrets")
OAUTH_KEYS = os.path.expanduser(r"~\.config\google-calendar-mcp\gcp-oauth.keys.json")
DIR = os.path.dirname(os.path.abspath(__file__))


def _refresh(tfile):
    """Refresh an OAuth token file in place if expired; return access_token."""
    t = json.load(open(tfile))
    if t.get("expires_at", 0) < time.time() + 30:
        ci = _oauth_client()
        data = urllib.parse.urlencode(
            {
                "client_id": ci["client_id"],
                "client_secret": ci["client_secret"],
                "refresh_token": t["refresh_token"],
                "grant_type": "refresh_token",
            }
        ).encode()
        n = json.loads(urllib.request.urlopen(ci["token_uri"], data=data, timeout=30).read())
        t.update(n)
        t["expires_at"] = time.time() + n.get("expires_in", 3600) - 60
        json.dump(t, open(tfile, "w"))
    return t["access_token"]


def read_token():
    return _refresh(os.path.join(KEYS, "gmail-token.json"))


def send_token():
    return _refresh(os.path.join(KEYS, "gmail-send-token.json"))


def _api(base, token, path, payload=None, method="GET"):
    url = base + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
        },
    )
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


def READ_API(path, payload=None, method="GET"):
    return _api(
        "https://gmail.googleapis.com/gmail/v1/users/me/",
        read_token(),
        path,
        payload,
        method,
    )


def _oauth_client():
    k = json.load(open(OAUTH_KEYS))
    return k.get("installed") or k.get("web")


def send_api(path, payload=None, method="GET"):
    return _api(
        "https://gmail.googleapis.com/gmail/v1/users/me/",
        send_token(),
        path,
        payload,
        method,
    )


def header(m, name):
    p = m.get("payload", m)
    return next(
        (h["value"] for h in p.get("headers", []) if h["name"].lower() == name.lower()),
        "",
    )


def body_text(payload):
    if payload.get("mimeType") == "text/plain" and payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", "replace")
    for part in payload.get("parts", []):
        t = body_text(part)
        if t:
            return t
    return ""


def attachments(payload):
    out = []
    if payload.get("filename"):
        out.append(
            {
                "filename": payload["filename"],
                "mimeType": payload.get("mimeType"),
                "size": payload.get("body", {}).get("size", 0),
                "attachmentId": payload.get("body", {}).get("attachmentId"),
            }
        )
    for part in payload.get("parts", []):
        out += attachments(part)
    return out


def t_search(args):
    q = args.get("query", "")
    maxn = int(args.get("max_results", 20))
    mode = args.get("mode", "threads")  # threads | messages
    if mode == "messages":
        res = READ_API("messages?q=" + urllib.parse.quote(q) + "&maxResults=" + str(maxn))
        out = []
        for m in res.get("messages", []):
            f = READ_API(
                "messages/"
                + m["id"]
                + "?format=metadata"
                + "&metadataHeaders=Subject&metadataHeaders=From"
                + "&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date"
            )
            out.append(
                {
                    "id": f["id"],
                    "threadId": f.get("threadId"),
                    "date": header(f, "Date"),
                    "from": header(f, "From"),
                    "to": header(f, "To"),
                    "cc": header(f, "Cc"),
                    "subject": header(f, "Subject"),
                    "labelIds": f.get("labelIds", []),
                    "snippet": f.get("snippet", ""),
                }
            )
        return {"messages": out}
    res = READ_API("threads?q=" + urllib.parse.quote(q) + "&maxResults=" + str(maxn))
    out = []
    for t in res.get("threads", []):
        th = READ_API(
            "threads/"
            + t["id"]
            + "?format=metadata"
            + "&metadataHeaders=Subject&metadataHeaders=From"
            + "&metadataHeaders=To&metadataHeaders=Date"
        )
        msgs = th.get("messages", [])
        if not msgs:
            continue
        last = msgs[-1]
        out.append(
            {
                "threadId": t["id"],
                "messageCount": len(msgs),
                "date": header(last, "Date"),
                "from": header(last, "From"),
                "to": header(last, "To"),
                "subject": header(last, "Subject"),
                "snippet": last.get("snippet", ""),
            }
        )
    return {"threads": out}


def t_read_thread(args):
    tid = args["thread_id"]
    maxchars = int(args.get("max_chars", 8000))
    th = READ_API("threads/" + tid + "?format=full")
    msgs = []
    for m in th.get("messages", []):
        p = m.get("payload", {})
        txt = body_text(p)
        msgs.append(
            {
                "id": m["id"],
                "date": header(m, "Date"),
                "from": header(m, "From"),
                "to": header(m, "To"),
                "cc": header(m, "Cc"),
                "subject": header(m, "Subject"),
                "messageIdHeader": header(m, "Message-ID"),
                "labelIds": m.get("labelIds", []),
                "attachments": attachments(p),
                "body": txt[:maxchars] + ("\n...[truncated]" if len(txt) > maxchars else ""),
            }
        )
    return {"threadId": tid, "messages": msgs}


def t_read_message(args):
    mid = args["message_id"]
    maxchars = int(args.get("max_chars", 8000))
    m = READ_API("messages/" + mid + "?format=full")
    p = m.get("payload", {})
    txt = body_text(p)
    return {
        "id": m["id"],
        "threadId": m.get("threadId"),
        "date": header(m, "Date"),
        "from": header(m, "From"),
        "to": header(m, "To"),
        "cc": header(m, "Cc"),
        "subject": header(m, "Subject"),
        "messageIdHeader": header(m, "Message-ID"),
        "labelIds": m.get("labelIds", []),
        "attachments": attachments(p),
        "body": txt[:maxchars] + ("\n...[truncated]" if len(txt) > maxchars else ""),
    }


def _mime_message(to, subject, body, cc=None, bcc=None, in_reply_to=None, references=None):
    msg = email.mime.text.MIMEText(body, "plain", "utf-8")
    msg["To"] = to
    if cc:
        msg["Cc"] = cc
    if bcc:
        msg["Bcc"] = bcc
    msg["Subject"] = email.header.Header(subject, "utf-8")
    me = "baltzakis.themis@gmail.com"
    msg["From"] = email.utils.formataddr(("Themistoklis Baltzakis", me))
    msg["Date"] = email.utils.formatdate(localtime=True)
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
    if references:
        msg["References"] = references
    return base64.urlsafe_b64encode(msg.as_bytes()).decode()


def _recipients(args):
    payload = {"raw": _mime_for(args)}
    if args.get("thread_id"):
        payload["threadId"] = args["thread_id"]
    return payload


def t_send(args):
    r = send_api("messages/send", _recipients(args), method="POST")
    return {
        "id": r.get("id"),
        "threadId": r.get("threadId"),
        "labelIds": r.get("labelIds"),
    }


def _cc_bcc(args, key):
    v = args.get(key)
    if isinstance(v, list):
        return ", ".join(v)
    return v


def _mime_for(args):
    tos = args["to"] if isinstance(args["to"], list) else [args["to"]]
    return _mime_message(
        ", ".join(tos),
        args["subject"],
        args["body"],
        cc=_cc_bcc(args, "cc"),
        bcc=_cc_bcc(args, "bcc"),
        in_reply_to=args.get("in_reply_to"),
        references=args.get("references"),
    )


def t_create_draft(args):
    body = {"message": {"raw": _mime_for(args)}}
    if args.get("thread_id"):
        body["message"]["threadId"] = args["thread_id"]
    r = send_api("drafts", body, method="POST")
    m = r.get("message", {})
    return {
        "id": r.get("id"),
        "message": {"id": m.get("id"), "threadId": m.get("threadId")},
    }


def t_list_drafts(args):
    res = send_api("drafts?maxResults=" + str(int(args.get("max_results", 20))))
    out = []
    for d in res.get("drafts", []):
        dd = send_api(
            "drafts/"
            + d["id"]
            + "?format=metadata"
            + "&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date"
        )
        m = dd.get("message", {})
        out.append(
            {
                "id": d["id"],
                "messageId": m.get("id"),
                "threadId": m.get("threadId"),
                "date": header(m, "Date"),
                "to": header(m, "To"),
                "subject": header(m, "Subject"),
            }
        )
    return {"drafts": out}


TOOLS = [
    {
        "name": "gmail_search",
        "description": 'Search Gmail (baltzakis.themis@gmail.com). mode=threads returns thread summaries; mode=messages returns individual message metadata. Query uses Gmail search syntax (from:, to:, subject:, newer_than:, "phrase").',
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "max_results": {"type": "integer", "default": 20},
                "mode": {
                    "type": "string",
                    "enum": ["threads", "messages"],
                    "default": "threads",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "gmail_read_thread",
        "description": "Read all messages in a Gmail thread (full bodies, attachments metadata).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "thread_id": {"type": "string"},
                "max_chars": {"type": "integer", "default": 8000},
            },
            "required": ["thread_id"],
        },
    },
    {
        "name": "gmail_read_message",
        "description": "Read a single Gmail message by message id (full body + attachment names).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "message_id": {"type": "string"},
                "max_chars": {"type": "integer", "default": 8000},
            },
            "required": ["message_id"],
        },
    },
    {
        "name": "gmail_send",
        "description": "Send an email FROM baltzakis.themis@gmail.com via the Gmail API (gmail.modify token). Supports threading via thread_id + in_reply_to/references headers.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "to": {"type": ["string", "array"], "items": {"type": "string"}},
                "subject": {"type": "string"},
                "body": {"type": "string", "description": "Plain text body (UTF-8 ok)"},
                "cc": {"type": ["string", "array"], "items": {"type": "string"}},
                "bcc": {"type": ["string", "array"], "items": {"type": "string"}},
                "thread_id": {"type": "string"},
                "in_reply_to": {
                    "type": "string",
                    "description": "parent Message-ID header",
                },
                "references": {"type": "string"},
            },
            "required": ["to", "subject", "body"],
        },
    },
    {
        "name": "gmail_create_draft",
        "description": "Create a Gmail draft (optionally threaded).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "to": {"type": ["string", "array"], "items": {"type": "string"}},
                "subject": {"type": "string"},
                "body": {"type": "string"},
                "cc": {"type": ["string", "array"], "items": {"type": "string"}},
                "thread_id": {"type": "string"},
                "in_reply_to": {"type": "string"},
                "references": {"type": "string"},
            },
            "required": ["to", "subject", "body"],
        },
    },
    {
        "name": "gmail_list_drafts",
        "description": "List Gmail drafts.",
        "inputSchema": {
            "type": "object",
            "properties": {"max_results": {"type": "integer", "default": 20}},
        },
    },
]

DISPATCH = {
    "gmail_search": t_search,
    "gmail_read_thread": t_read_thread,
    "gmail_read_message": t_read_message,
    "gmail_send": t_send,
    "gmail_create_draft": t_create_draft,
    "gmail_list_drafts": t_list_drafts,
}


def reply(mid, result=None, error=None):
    msg = {"jsonrpc": "2.0", "id": mid}
    if error is not None:
        msg["error"] = error
    else:
        msg["result"] = result
    sys.stdout.write(json.dumps(msg, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        mid = req.get("id")
        method = req.get("method", "")
        params = req.get("params") or {}

        if method == "initialize":
            reply(
                mid,
                {
                    "protocolVersion": params.get("protocolVersion", "2025-03-26"),
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "gmail-local", "version": "1.0.0"},
                },
            )
        elif method in ("notifications/initialized", "notifications/cancelled"):
            pass
        elif method == "ping":
            reply(mid, {})
        elif method == "tools/list":
            reply(mid, {"tools": TOOLS})
        elif method == "tools/call":
            name = params.get("name", "")
            args = params.get("arguments") or {}
            fn = DISPATCH.get(name)
            if not fn:
                reply(mid, error={"code": -32601, "message": "unknown tool " + name})
                continue
            try:
                res = fn(args)
                reply(
                    mid,
                    {
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(res, ensure_ascii=True, indent=1),
                            }
                        ],
                        "isError": False,
                    },
                )
            except Exception as e:
                reply(
                    mid,
                    {
                        "content": [{"type": "text", "text": "ERROR: " + str(e)}],
                        "isError": True,
                    },
                )
        elif mid is not None:
            reply(mid, error={"code": -32601, "message": "method not found: " + method})


if __name__ == "__main__":
    main()
