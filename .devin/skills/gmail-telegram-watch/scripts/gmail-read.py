#!/usr/bin/env python3
"""gmail-read — search/read the baltzakis.themis@gmail.com mailbox.

Thin CLI over gmail-fetch.py's OAuth token (readonly scope). Use when
the `gmail` MCP server is failing (it has been returning
"Failed to connect" / invalid_grant). For SENDING use gmail-send-ops
(gmail-schedule-reply.py, gmail.modify token) — this tool is read-only.

usage:
  gmail-read.py search QUERY [--max N]     # threads matching Gmail query
  gmail-read.py read THREAD_ID [--max-chars N]
  gmail-read.py list [--max N] [--label INBOX]

Examples:
  gmail-read.py search "to:mpaltzakis13@hotmail.com newer_than:7d"
  gmail-read.py search "polish" --max 10
  gmail-read.py read 1a1c1b5d9a53a46d

search prints one JSON object per line: thread id, message count, date,
from/to, subject, snippet. read prints every message in the thread with
headers, decoded text body and attachment names.
"""

import importlib.util
import json
import os
import sys
import urllib.parse

DIR = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("gf", os.path.join(DIR, "gmail-fetch.py"))
gf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gf)  # also re-wraps sys.stdout as utf-8/replace
api = gf.api
header = gf.header
body_text = gf.body_text


def cmd_search(q, maxn):
    res = api(
        "threads?q="
        + urllib.parse.quote(q)
        + "&maxResults="
        + str(maxn)
        + "&format=metadata&metadataHeaders=Subject&metadataHeaders=From"
        + "&metadataHeaders=To&metadataHeaders=Date"
    )
    for t in res.get("threads", []):
        msgs = t.get("messages", [])
        if not msgs:
            continue
        last = msgs[-1]
        p = last.get("payload", {})
        hs = {h["name"]: h["value"] for h in p.get("headers", [])}
        print(
            json.dumps(
                {
                    "thread": t["id"],
                    "messages": len(msgs),
                    "date": hs.get("Date", ""),
                    "from": hs.get("From", ""),
                    "to": hs.get("To", ""),
                    "subject": hs.get("Subject", ""),
                    "snippet": last.get("snippet", ""),
                },
                ensure_ascii=False,
            )
        )


def cmd_read(tid, maxchars):
    th = api("threads/" + tid + "?format=full")
    for m in th.get("messages", []):
        p = m.get("payload", {})
        atts = []

        def walk(pl, _atts=atts):
            if pl.get("filename"):
                _atts.append(pl["filename"])
            for c in pl.get("parts", []):
                walk(c)

        walk(p)
        txt = body_text(p) or ""
        print("=" * 60)
        print("message:", m["id"], "| thread:", th["id"])
        for k in ("Date", "From", "To", "Cc", "Subject", "Message-ID"):
            print(f"{k}: {header(m, k)}")
        if atts:
            print("attachments:", ", ".join(atts))
        print("-" * 60)
        print(txt[:maxchars] + ("\n...[truncated]" if len(txt) > maxchars else ""))


def cmd_list(maxn, label):
    path = (
        "messages?maxResults=" + str(maxn) + "&format=metadata"
        "&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date"
    )
    if label:
        path += "&labelIds=" + urllib.parse.quote(label)
    res = api(path)
    for m in res.get("messages", []):
        f = api(
            "messages/"
            + m["id"]
            + "?format=metadata&metadataHeaders=Subject"
            + "&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date"
        )
        p = f.get("payload", {})
        hs = {h["name"]: h["value"] for h in p.get("headers", [])}
        labs = ",".join(f.get("labelIds", []))
        print(
            json.dumps(
                {
                    "id": m["id"],
                    "date": hs.get("Date", ""),
                    "from": hs.get("From", ""),
                    "to": hs.get("To", ""),
                    "subject": hs.get("Subject", ""),
                    "labels": labs,
                    "snippet": f.get("snippet", ""),
                },
                ensure_ascii=False,
            )
        )


def main():
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        sys.exit(2)
    cmd = argv.pop(0)

    def opt(name, default=None, cast=str):
        if name in argv:
            i = argv.index(name)
            v = argv[i + 1]
            del argv[i : i + 2]
            return cast(v)
        return default

    maxn = opt("--max", 20, int)
    maxchars = opt("--max-chars", 6000, int)
    label = opt("--label")

    if cmd == "search":
        if not argv:
            print(__doc__)
            sys.exit(2)
        cmd_search(" ".join(argv), maxn)
    elif cmd == "read":
        if not argv:
            print(__doc__)
            sys.exit(2)
        cmd_read(argv[0], maxchars)
    elif cmd == "list":
        cmd_list(maxn, label)
    else:
        print("unknown command:", cmd)
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    main()
