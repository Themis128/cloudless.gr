#!/usr/bin/env python3
"""Run Lighthouse against production (or override URLs) and write
JSON reports + a summary.json.

Usage: python3 scripts/lighthouse-local.py [url ...]
Config: lighthouserc.local.cjs · env LIGHTHOUSE_OUT_DIR
(default .lighthouseci)"""

import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)

OUT_DIR = Path(os.environ.get("LIGHTHOUSE_OUT_DIR", ".lighthouseci"))
OUT_DIR.mkdir(exist_ok=True)

URLS = sys.argv[1:] or [
    "https://cloudless.gr/en",
    "https://cloudless.gr/en/services",
    "https://cloudless.gr/en/store",
    "https://cloudless.gr/en/contact",
]

print(f"== Warming {len(URLS)} URL(s) ==")
for url in URLS:
    try:
        import time

        t0 = time.monotonic()
        code = urllib.request.urlopen(url, timeout=15).status
        print(f"{url} → {code} ({time.monotonic() - t0:.3f}s)")
        urllib.request.urlopen(url, timeout=15)
    except Exception:
        pass

CHROME_FLAGS = "--headless=new --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"
SUMMARY = OUT_DIR / "summary.json"
SUMMARY.write_text("[]")

PICK_IDS = [
    "cumulative-layout-shift",
    "total-blocking-time",
    "largest-contentful-paint",
    "first-contentful-paint",
    "speed-index",
    "interactive",
    "server-response-time",
    "mainthread-work-breakdown",
    "bootup-time",
    "dom-size",
    "third-party-summary",
    "unused-javascript",
    "unused-css-rules",
    "render-blocking-resources",
    "uses-responsive-images",
    "offscreen-images",
]


def pick(audits: dict, aid: str) -> dict | None:
    a = audits.get(aid)
    if not a:
        return None
    return {
        "id": aid,
        "title": a.get("title"),
        "score": a.get("score"),
        "displayValue": a.get("displayValue"),
        "numericValue": a.get("numericValue"),
    }


def run_one(form: str, url: str) -> None:
    slug = re.sub(r"[^a-zA-Z0-9]", "-", url.replace("https://", ""))
    out = OUT_DIR / f"{slug}-{form}.json"
    print(f"\n== Lighthouse {form}: {url} ==")
    if form == "desktop":
        form_args = ["--preset=desktop"]
    else:
        form_args = [
            "--form-factor=mobile",
            "--screenEmulation.mobile",
            "--throttling.cpuSlowdownMultiplier=4",
        ]
    r = subprocess.run(
        [
            "pnpm",
            "exec",
            "lighthouse",
            url,
            "--quiet",
            f"--chrome-flags={CHROME_FLAGS}",
            *form_args,
            "--throttling-method=devtools",
            "--only-categories=performance,accessibility,best-practices,seo",
            "--blocked-url-patterns=*cdn-cgi/challenge-platform*",
            "--blocked-url-patterns=*challenges.cloudflare.com*",
            '--extra-headers={"X-Forwarded-Proto":"https"}',
            "--output=json",
            f"--output-path={out}",
        ]
    )
    if r.returncode != 0 or not out.is_file():
        print(f"  lighthouse failed for {url}")
        return

    rep = json.loads(out.read_text())
    cats = rep.get("categories") or {}
    audits = rep.get("audits") or {}
    opportunities = sorted(
        (
            {
                "id": a.get("id"),
                "title": a.get("title"),
                "score": a.get("score"),
                "displayValue": a.get("displayValue"),
                "savingsMs": a.get("numericValue"),
            }
            for a in audits.values()
            if (a.get("details") or {}).get("type") == "opportunity" and (a.get("score") or 1) < 0.9
        ),
        key=lambda a: -(a["savingsMs"] or 0),
    )[:8]
    diagnostics = [p for p in (pick(audits, i) for i in PICK_IDS) if p]
    row = {
        "url": rep.get("finalDisplayedUrl") or rep.get("requestedUrl"),
        "formFactor": form,
        "fetchTime": rep.get("fetchTime"),
        "scores": {
            "performance": (cats.get("performance") or {}).get("score"),
            "accessibility": (cats.get("accessibility") or {}).get("score"),
            "bestPractices": (cats.get("best-practices") or {}).get("score"),
            "seo": (cats.get("seo") or {}).get("score"),
        },
        "metrics": {
            "fcp": pick(audits, "first-contentful-paint"),
            "lcp": pick(audits, "largest-contentful-paint"),
            "tbt": pick(audits, "total-blocking-time"),
            "cls": pick(audits, "cumulative-layout-shift"),
            "si": pick(audits, "speed-index"),
            "tti": pick(audits, "interactive"),
            "ttfb": pick(audits, "server-response-time"),
        },
        "opportunities": opportunities,
        "diagnostics": diagnostics,
    }
    all_rows = json.loads(SUMMARY.read_text())
    all_rows.append(row)
    SUMMARY.write_text(json.dumps(all_rows, indent=2))

    s = row["scores"]
    print(
        f"  Perf={round((s['performance'] or 0) * 100)} "
        f"A11y={round((s['accessibility'] or 0) * 100)} "
        f"BP={round((s['bestPractices'] or 0) * 100)} "
        f"SEO={round((s['seo'] or 0) * 100)}"
    )
    m = row["metrics"]
    print(
        f"  LCP={(m['lcp'] or {}).get('displayValue')} "
        f"TBT={(m['tbt'] or {}).get('displayValue')} "
        f"CLS={(m['cls'] or {}).get('displayValue')}"
    )


for url in URLS:
    run_one("desktop", url)
run_one("mobile", URLS[0])

print(f"\n== Summary written to {SUMMARY} ==")
summary = json.loads(SUMMARY.read_text())
print(
    json.dumps(
        [
            {
                "url": r["url"],
                "form": r["formFactor"],
                "scores": {k: round((v or 0) * 100) for k, v in r["scores"].items()},
            }
            for r in summary
        ],
        indent=2,
    )
)
