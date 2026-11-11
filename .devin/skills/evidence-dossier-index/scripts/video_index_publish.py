#!/usr/bin/env python3
"""video_index_publish.py — rebuild VIDEO_INDEX.pdf with links for EVERY clip.

Pulls the live mp4 inventory from omv (duration via ffprobe, size, fresh
SHA-256), generates VIDEO-INDEX.html with clickable R2 links, then runs
publish-doc.py (HTML -> PDF -> omv -> R2 sync -> verify).

usage: video_index_publish.py [--case mpaltzakis-house-2026-11] [--no-upload]
"""

import argparse
import html
import os
import subprocess
import sys
from pathlib import Path

SKILLS_ROOT = Path(__file__).resolve().parents[2]
PUBLISH = str(SKILLS_ROOT / "evidence-doc-publish" / "scripts" / "publish-doc.py")
SRC_DIR = os.environ.get(
    "EVIDENCE_CASE_SRC", r"C:\Users\tbaltzakis\Documents\mpaltzakis-correspondence"
)


def _evidence_token():
    """Bearer token for the tokenized evidence host — resolve, never hardcode."""
    env = os.environ.get("EVIDENCE_TOKEN")
    if env:
        return env.strip()
    for path in (
        os.path.join(os.environ.get("APPDATA", ""), "devin", "secrets", "evidence-token.txt"),
        os.path.expanduser("~/.config/devin/secrets/evidence-token.txt"),
    ):
        if path and os.path.exists(path):
            token = open(path, encoding="utf-8").read().strip()
            if token:
                return token
    sys.exit(
        "FAIL: no evidence token — set EVIDENCE_TOKEN or write %APPDATA%/devin/secrets/evidence-token.txt"
    )


def r2_base(case):
    return (
        "https://pub-6db4c5dc5fee4d5ba450ae560cf8340c.r2.dev/t/"
        + _evidence_token()
        + "/"
        + case
        + "/"
    )


OMV_CASE = "/home/tbaltzakis/evidence/{case}"

REMOTE_CMD = r"""
cd {dir}/video-src 2>/dev/null || exit 3
find . -name '*.mp4' -print0 | while IFS= read -r -d '' f; do
  rel=${{f#./}}
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null)
  sz=$(stat -c%s "$f")
  sha=$(sha256sum "$f" | cut -c1-16)
  echo "$rel|$dur|$sz|$sha"
done
"""


def collect(case):
    cmd = ["ssh", "-o", "BatchMode=yes", "omv", REMOTE_CMD.format(dir=OMV_CASE.format(case=case))]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if r.returncode != 0:
        sys.exit("FAIL inventory: " + r.stderr.strip())
    rows = []
    for line in r.stdout.splitlines():
        parts = line.strip().split("|")
        if len(parts) == 4 and parts[0].endswith(".mp4"):
            try:
                dur = float(parts[1]) if parts[1] not in ("", "N/A") else 0.0
                size = int(parts[2])
            except ValueError:
                continue
            rows.append(
                {
                    "path": parts[0],
                    "dur": dur,
                    "size": size,
                    "sha": parts[3],
                }
            )
    if not rows:
        sys.exit("FAIL: no mp4 found under video-src/")
    return rows


def fmt_dur(sec):
    sec = int(round(sec))
    return f"{sec // 60:02d}:{sec % 60:02d}"


def fmt_sz(b):
    return f"{b / 1048576:.1f} MB" if b >= 1048576 else f"{int(b / 1024)} KB"


def build_html(rows, case):
    groups = {}
    for r in rows:
        groups.setdefault(r["path"].split("/")[0], []).append(r)
    base = r2_base(case)
    out = []
    for cam in sorted(groups):
        clips = sorted(groups[cam], key=lambda r: r["path"])
        out.append(f"<h3>Κάμερα {html.escape(cam.upper())} — {len(clips)} κλιπ</h3>")
        out.append(
            "<table><tr><th>Αρχείο</th><th>Διάρκεια</th><th>Μέγεθος</th><th>SHA-256</th></tr>"
        )
        for c in clips:
            name = c["path"].split("/")[-1]
            url = html.escape(base + c["path"])
            out.append(
                '<tr><td><a href="{}">{}</a></td><td>{}</td>'
                '<td>{}</td><td class="hash">{}…</td></tr>'.format(
                    url, html.escape(name), fmt_dur(c["dur"]), fmt_sz(c["size"]), c["sha"]
                )
            )
        out.append("</table>")
    return f"""<!DOCTYPE html><html lang="el"><head><meta charset="utf-8">
<title>VIDEO INDEX — {case}</title>
<style>
body{{font-family:Arial,Helvetica,sans-serif;font-size:10pt;margin:2cm;color:#111}}
h1{{font-size:15pt}} h3{{font-size:12pt;margin-top:14pt}}
table{{border-collapse:collapse;width:100%}} th,td{{border:1px solid #999;padding:3px 6px;text-align:left;font-size:9pt}}
th{{background:#eee}} td.hash{{font-family:monospace;font-size:8pt;color:#444}}
a{{color:#0645ad}}
.note{{font-size:9pt;color:#444;font-style:italic}}
</style></head><body>
<h1>Ευρετήριο Βίντεο-Τεκμηρίων — {case}</h1>
<p>Σύνολο: {len(rows)} κλιπ MP4 (H.264) από τις κάμερες του φακέλου.
Κάθε link αναπαράγεται απευθείας σε οποιονδήποτε browser (HTTP range streaming).<br>
<span class="note">Βάση αρχείων: Cloudflare R2 — ίδιο token path με το
failover evidence.cloudless.gr. SHA-256: πρώτο 16 δεκαεξαδικά ψηφία.</span></p>
{"".join(out)}
</body></html>"""


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--case", default="mpaltzakis-house-2026-11")
    ap.add_argument("--no-upload", action="store_true")
    a = ap.parse_args()

    rows = collect(a.case)
    print("clips found:", len(rows), "| cameras:", sorted({r["path"].split("/")[0] for r in rows}))

    html_path = os.path.join(SRC_DIR, "VIDEO-INDEX.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(build_html(rows, a.case))
    print("html:", html_path)

    cmd = [
        sys.executable,
        PUBLISH,
        "VIDEO-INDEX.html",
        "--out",
        "VIDEO_INDEX.pdf",
        "--case",
        a.case,
    ]
    if a.no_upload:
        cmd.append("--no-upload")
    subprocess.run(cmd, check=True)

    # verify the produced PDF link count matches inventory
    try:
        from pypdf import PdfReader

        pdf = os.path.join(SRC_DIR, "VIDEO_INDEX.pdf")
        r = PdfReader(pdf)
        n = sum(
            1
            for p in r.pages
            for an in (p.get("/Annots") or [])
            if an.get_object().get("/A", {}).get("/URI")
        )
        print(f"pdf link annots: {n} (expected {len(rows)})")
        if n != len(rows):
            sys.exit("FAIL: link count mismatch")
    except ImportError:
        print("(pypdf missing — skipping annot check)")


if __name__ == "__main__":
    main()
