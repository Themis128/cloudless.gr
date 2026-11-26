#!/usr/bin/env python3
"""dypa-status-check — one-shot status digest for the DYPA 1.000 ptyxiouxon program.

Checks three lanes and prints a compact report:

  1. dypa.gov.gr program page — fetches the page, lists dated announcements
     and document links (looking for Οριστικοί Πίνακες / συστατικά σημειώματα).
  2. Gmail — inbound mail from/to any dypa.gov.gr address in the last N days
     (uses gmail-telegram-watch gmail-fetch.py, readonly token).
  3. Local correspondence folder — newest files in Documents\\dypa-1000-ptyxiouxon.

usage:
  python dypa-status-check.py [--days 14] [--save report.txt]
"""

import argparse
import datetime
import importlib.util
import os
import re
import sys
import urllib.parse
import urllib.request

SKILLS = os.path.join(os.environ.get("APPDATA", ""), "devin", "skills")
GF_PATH = os.path.join(SKILLS, "gmail-telegram-watch", "scripts", "gmail-fetch.py")
CORR_DIR = os.path.join(os.path.expanduser("~"), "Documents", "dypa-1000-ptyxiouxon")
PROGRAM_URL = (
    "https://www.dypa.gov.gr/el/active-employment-policies/"
    "eidiko-proghramma-apaskholisis-ghia-1000-anerghoys-ptikhioukhoys-"
    "aei-pe-kai-te-ilikias-25-54-etwn-sti-dypa"
)
KEYWORDS = [
    "οριστικ",
    "πίνακ",
    "πινακ",
    "συστατικ",
    "συνέντευξ",
    "συνεντευξ",
    "τοποθέτησ",
    "τοποθετησ",
    "προσωριν",
    "αναμορφωμ",
    "πρόσκλησ",
]


def gmail_messages(query):
    spec = importlib.util.spec_from_file_location("gf", GF_PATH)
    gf = importlib.util.module_from_spec(spec)
    sys.argv = ["gmail-fetch.py"]
    spec.loader.exec_module(gf)
    res = gf.api("messages?q=" + urllib.parse.quote(query) + "&maxResults=25")
    out = []
    for m in res.get("messages", []):
        f = gf.api(
            "messages/"
            + m["id"]
            + "?format=metadata&metadataHeaders=From&metadataHeaders=To"
            + "&metadataHeaders=Subject&metadataHeaders=Date"
        )
        hdrs = {h["name"].lower(): h["value"] for h in f["payload"]["headers"]}
        out.append(
            {
                "id": m["id"],
                "threadId": f.get("threadId"),
                "date": hdrs.get("date", ""),
                "from": hdrs.get("from", ""),
                "to": hdrs.get("to", ""),
                "subject": hdrs.get("subject", ""),
            }
        )
    return out


def check_page():
    req = urllib.request.Request(PROGRAM_URL, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    hits = []
    for kw in KEYWORDS:
        for m in re.finditer(re.escape(kw), text, re.IGNORECASE):
            s = max(0, m.start() - 120)
            hits.append(text[s : m.end() + 120].strip())
    # unique, keep order
    seen, uniq = set(), []
    for h in hits:
        if h not in seen:
            seen.add(h)
            uniq.append(h)
    links = sorted(set(re.findall(r'href="([^"]*(?:dypa|storage|\.pdf)[^"]*)"', html)))
    return uniq[:15], links[:20]


def check_mail(days):
    q = f"dypa.gov.gr newer_than:{days}d"
    return gmail_messages(q)


def check_local():
    if not os.path.isdir(CORR_DIR):
        return []
    files = [f for f in os.listdir(CORR_DIR) if os.path.isfile(os.path.join(CORR_DIR, f))]
    files.sort(reverse=True)
    return files[:10]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--save", metavar="PATH")
    a = ap.parse_args()

    lines = []
    lines.append("=" * 70)
    lines.append(f"DYPA 1.000 πτυχιούχων — status check {datetime.datetime.now():%Y-%m-%d %H:%M}")
    lines.append("=" * 70)

    lines.append("\n## 1. dypa.gov.gr program page")
    try:
        hits, links = check_page()
        if hits:
            lines.append("keyword hits:")
            lines += ["  - " + h for h in hits]
        else:
            lines.append("  (no announcement keywords found)")
        if links:
            lines.append("document/page links:")
            lines += ["  - " + link for link in links]
    except Exception as e:
        lines.append(f"  ERROR fetching page: {e!r}")

    lines.append(f"\n## 2. Gmail (dypa.gov.gr, last {a.days} days)")
    try:
        msgs = check_mail(a.days)
        if msgs:
            for m in msgs:
                lines.append(f"  {m['date'][:16]} | {m['from'][:60]} | {m['subject'][:80]}")
        else:
            lines.append("  (no mail)")
    except Exception as e:
        lines.append(f"  ERROR gmail: {e!r}")

    lines.append(f"\n## 3. Local correspondence ({CORR_DIR})")
    for f in check_local():
        lines.append("  - " + f)

    report = "\n".join(lines)
    print(report)
    if a.save:
        with open(a.save, "w", encoding="utf-8") as fh:
            fh.write(report + "\n")
        print("\nsaved ->", a.save)


if __name__ == "__main__":
    main()
