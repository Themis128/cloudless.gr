#!/usr/bin/env python3
"""cwv_triage.py — decode a core-web-vitals-audit run into actionable findings.

    python3 cwv_triage.py [RUN_ID]      # latest failed run if omitted
    python3 cwv_triage.py --local DIR   # parse already-downloaded artifacts

Downloads the run's lighthouse-results artifact, parses every lhr-*.json,
and prints per-route category medians + the exact failing audits with
their messages (meta-description, robots-txt lines, tap-targets, etc.).

Requires: gh CLI auth, repo Themis128/cloudless.gr.
"""

import glob
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile

REPO = "Themis128/cloudless.gr"
GATES = {"performance": 0.55, "accessibility": 0.90, "best-practices": 0.90, "seo": 0.90}
# audits whose details carry per-line messages worth surfacing
DETAIL_AUDITS = {"robots-txt", "tap-targets", "crawlable-anchors", "image-alt"}


def latest_failed_run() -> str | None:
    r = subprocess.run(
        [
            shutil.which("gh") or "gh",
            "run",
            "list",
            "--repo",
            REPO,
            "--workflow",
            "core-web-vitals-audit.yml",
            "--limit",
            "10",
            "--json",
            "databaseId,conclusion",
            "--jq",
            '[.[]|select(.conclusion=="failure")][0].databaseId',
        ],
        capture_output=True,
        text=True,
    )
    v = r.stdout.strip()
    return v or None


def download(run_id: str) -> str:
    d = tempfile.mkdtemp(prefix="cwv-")
    subprocess.run(
        [shutil.which("gh") or "gh", "run", "download", run_id, "--repo", REPO, "-D", d],
        capture_output=True,
        text=True,
    )
    return d


def analyze(root: str) -> list[dict]:
    routes = {}
    for f in sorted(glob.glob(os.path.join(root, "**", "lhr-*.json"), recursive=True)):
        try:
            d = json.load(open(f))
        except Exception:
            continue
        url = d.get("finalDisplayedUrl") or d.get("requestedUrl", "?")
        path = re.sub(r"^https?://[^/]+", "", url)
        cats = {k: c.get("score") for k, c in d.get("categories", {}).items()}
        fails = []
        for aid, a in d.get("audits", {}).items():
            if a.get("score") not in (None, 1) and a.get("scoreDisplayMode") not in (
                "notApplicable",
                "manual",
                "informative",
            ):
                entry = {"id": aid, "title": a.get("title", "")}
                if aid in DETAIL_AUDITS:
                    items = a.get("details", {}).get("items", [])
                    entry["lines"] = [
                        f"  line {i.get('index')}: {i.get('line', i.get('node', {}).get('snippet', ''))[:60]} — {i.get('message', '')}"
                        for i in items[:6]
                    ]
                fails.append(entry)
        r = routes.setdefault(path, {"cats": [], "fails": []})
        r["cats"].append(cats)
        r["fails"].extend(fails)
    out = []
    for path, r in routes.items():
        med = {}
        for k in GATES:
            vals = [c[k] for c in r["cats"] if c.get(k) is not None]
            if vals:
                med[k] = round(statistics.median(vals), 2)
        out.append({"path": path, "medians": med, "fails": r["fails"]})
    return out


def main() -> int:
    if "--local" in sys.argv:
        root = sys.argv[sys.argv.index("--local") + 1]
    else:
        run = (
            sys.argv[1]
            if len(sys.argv) > 1 and not sys.argv[1].startswith("-")
            else latest_failed_run()
        )
        if not run:
            print("no failed run found")
            return 1
        print(f"run {run}")
        root = download(run)
    for r in analyze(root):
        bad = [f"{k}={v}(gate {GATES[k]})" for k, v in r["medians"].items() if v < GATES[k]]
        mark = "FAIL " if bad else "pass "
        print(f"{mark}{r['path']}  " + " ".join(f"{k}={v}" for k, v in r["medians"].items()))
        if bad:
            print("      failing:", "; ".join(bad))
        for f in r["fails"]:
            print(f"   - {f['id']}: {f['title'][:70]}")
            for line in f.get("lines", []):
                print("    ", line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
