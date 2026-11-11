#!/usr/bin/env python3
"""cloudless-mail — stdio MCP server for tbaltzakis@cloudless.gr.

Wraps the cloudless-mail-ops CLI (Dovecot Maildir on omv-ha via SSH +
mail-outbound Cloudflare worker for sending). Same transport as
cloudless-mail.py: read/search/get over SSH, send via the worker.

Tools: mail_folders, mail_list, mail_search, mail_read,
mail_get_attachment, mail_send.

Protocol: MCP stdio — newline-delimited JSON-RPC 2.0.
"""

import base64
import contextlib
import importlib.util
import io
import json
import os
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
CM_PATH = os.path.normpath(
    os.path.join(HERE, "..", "..", "cloudless-mail-ops", "scripts", "cloudless-mail.py")
)

spec = importlib.util.spec_from_file_location("cloudless_mail", CM_PATH)
cm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cm)


def _j(*args):
    return json.loads(cm.remote(*args))


def _folder_user(args):
    return args.get("folder"), args.get("user", "tbaltzakis")


def t_folders(args):
    folder, user = _folder_user(args)
    return _j("folders", "--user", user)


def t_list(args):
    folder, user = _folder_user(args)
    a = ([folder] if folder else []) + ["--max", str(int(args.get("max", 20)))]
    if args.get("since"):
        a += ["--since", str(args["since"])]
    a += ["--user", user]
    return _j("list", *a)


def t_search(args):
    folder, user = _folder_user(args)
    terms = args.get("terms") or args.get("query") or ""
    if isinstance(terms, str):
        terms = terms.split()
    if not terms:
        raise ValueError("mail_search requires a non-empty terms or query")
    a = [folder or "all"] + [str(t) for t in terms]
    a += ["--user", user, "--max", str(int(args.get("max", 20)))]
    if args.get("since"):
        a += ["--since", str(args["since"])]
    return _j("search", *a)


def t_read(args):
    folder, user = _folder_user(args)
    a = ([folder] if folder else []) + [args["substr"], "--user", user]
    return _j("read", *a)


def t_get_attachment(args):
    folder, user = _folder_user(args)
    a = ([folder] if folder else []) + [args["substr"], "--user", user]
    if args.get("att") is not None:
        a += ["--att", str(args["att"])]
    if args.get("name"):
        a += ["--name", str(args["name"])]
    out = _j("getatt", *a)
    if "b64" not in out:
        return out
    if args.get("save_path"):
        dest = args["save_path"]
        with open(dest, "wb") as f:
            f.write(base64.b64decode(out["b64"]))
        out = dict(out)
        out["saved"] = os.path.abspath(dest)
        del out["b64"]
    return out


def t_send(args):
    ns = types.SimpleNamespace(
        to=args["to"],
        subject=args["subject"],
        body=args.get("body"),
        body_file=args.get("body_file"),
        cc=args.get("cc"),
        category=args.get("category", "user-mail"),
        user=args.get("user", "tbaltzakis"),
    )
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        cm.cmd_send(ns)
    return json.loads(buf.getvalue())


FOLDER_PROP = {
    "type": "string",
    "description": "Folder: INBOX, Sent, Drafts, Trash, Junk, Heartbeat; omit for all",
}
USER_PROP = {"type": "string", "default": "tbaltzakis"}

TOOLS = [
    {
        "name": "mail_folders",
        "description": "List Maildir folders and message counts for the cloudless.gr mailbox.",
        "inputSchema": {"type": "object", "properties": {"user": USER_PROP}},
    },
    {
        "name": "mail_list",
        "description": "List recent messages (date/from/to/subject/size/attachments) in a folder or all folders.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "folder": FOLDER_PROP,
                "user": USER_PROP,
                "max": {"type": "integer", "default": 20},
                "since": {"type": "string", "description": "YYYY-MM-DD or epoch"},
            },
        },
    },
    {
        "name": "mail_search",
        "description": "Search messages. terms are ANDed substrings; prefix field: e.g. from:x to:x subject:x body:x. Plain terms match headers+body.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "folder": FOLDER_PROP,
                "user": USER_PROP,
                "terms": {"type": "array", "items": {"type": "string"}},
                "query": {
                    "type": "string",
                    "description": "space-separated terms (alternative to terms[])",
                },
                "max": {"type": "integer", "default": 20},
                "since": {"type": "string"},
            },
            "required": [],
        },
    },
    {
        "name": "mail_read",
        "description": "Read one message. substr matches the Maildir filename — usually the delivery timestamp prefix from mail_list/mail_search results.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "folder": FOLDER_PROP,
                "user": USER_PROP,
                "substr": {"type": "string"},
            },
            "required": ["substr"],
        },
    },
    {
        "name": "mail_get_attachment",
        "description": "Download an attachment from a message. Pick with att (0-based index) or name (filename substring); if the message has exactly one attachment neither is needed. Returns base64 unless save_path is given (then writes the file and returns metadata only).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "folder": FOLDER_PROP,
                "user": USER_PROP,
                "substr": {"type": "string"},
                "att": {"type": "integer"},
                "name": {"type": "string"},
                "save_path": {"type": "string"},
            },
            "required": ["substr"],
        },
    },
    {
        "name": "mail_send",
        "description": "Send a plain-text email AS @cloudless.gr via the mail-outbound worker. No attachments, no HTML.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "to": {"type": "string"},
                "subject": {"type": "string"},
                "body": {"type": "string"},
                "body_file": {"type": "string"},
                "cc": {"type": "string"},
                "category": {"type": "string", "default": "user-mail"},
                "user": USER_PROP,
            },
            "required": ["to", "subject"],
        },
    },
]

DISPATCH = {
    "mail_folders": t_folders,
    "mail_list": t_list,
    "mail_search": t_search,
    "mail_read": t_read,
    "mail_get_attachment": t_get_attachment,
    "mail_send": t_send,
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
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
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
                    "serverInfo": {"name": "cloudless-mail", "version": "1.0.0"},
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
