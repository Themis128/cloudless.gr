#!/usr/bin/env python3
"""github-stars.py — fetch a repo's stargazer timestamps and render
by-day + by-hour star charts in the CLI.

Port of github-stars.sh.

Usage:
  github-stars.py <owner/repo | search-term> [--tz <IANA tz>] [--days N] [--hours-days N]

Examples:
  github-stars.py melandlabs/openloomi
  github-stars.py openloomi --tz America/Los_Angeles --days 14 --hours-days 2

Notes:
  - Needs `gh` authenticated (gh auth status).
  - GitHub only returns starred_at for the first 40,000 stargazers (API cap).
  - Default timezone is America/Los_Angeles (PT). Pass --tz for another.
"""

import json
import subprocess
import sys
from collections import Counter
from datetime import UTC, datetime
from zoneinfo import ZoneInfo


def gh(*args: str) -> str:
    r = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    if r.returncode != 0:
        print(r.stderr or "gh api failed", file=sys.stderr)
        sys.exit(1)
    return r.stdout or ""


def gh_json(*args: str) -> object:
    return json.loads(gh(*args))


repo = ""
tz_name = "America/Los_Angeles"
days_n = 14
hours_days = 2

args = sys.argv[1:]
i = 0
while i < len(args):
    if args[i] == "--tz":
        tz_name = args[i + 1]
        i += 2
    elif args[i] == "--days":
        days_n = int(args[i + 1])
        i += 2
    elif args[i] == "--hours-days":
        hours_days = int(args[i + 1])
        i += 2
    else:
        repo = args[i]
        i += 1

if not repo:
    print("usage: github-stars.py <owner/repo | search-term> [--tz TZ] [--days N] [--hours-days N]", file=sys.stderr)
    sys.exit(1)

# Resolve a search term to a full owner/repo (top result by stars).
if "/" not in repo:
    print(f"Searching GitHub for '{repo}'...", file=sys.stderr)
    r = subprocess.run(
        ["gh", "api", f"search/repositories?q={repo}&sort=stars&order=desc"],
        capture_output=True,
        text=True,
        check=False,
    )
    resolved = ""
    if r.returncode == 0:
        try:
            items = json.loads(r.stdout).get("items", [])
            if items:
                resolved = items[0].get("full_name", "")
        except json.JSONDecodeError:
            pass
    if not resolved:
        print(f"No repo found for '{repo}'.", file=sys.stderr)
        sys.exit(1)
    print(f"Resolved to: {resolved}", file=sys.stderr)
    repo = resolved

info = gh_json(f"repos/{repo}")
cnt = int(info.get("stargazers_count", 0)) if isinstance(info, dict) else 0
print(f"Repo: {repo}   total stars: {cnt}", file=sys.stderr)
pages = (cnt + 99) // 100
if cnt > 40000:
    print(f"WARNING: {cnt} stars exceeds the 40,000 timestamp cap; only the earliest 40k have starred_at.", file=sys.stderr)
    pages = 400

print(f"Fetching {pages} page(s) of stargazer timestamps...", file=sys.stderr)
rows: list[str] = []
for p in range(1, pages + 1):
    out = gh(
        "api",
        "-H",
        "Accept: application/vnd.github.star+json",
        f"repos/{repo}/stargazers?per_page=100&page={p}",
        "--jq",
        ".[].starred_at",
    )
    rows.extend(line.strip() for line in out.splitlines() if line.strip())

tz = ZoneInfo(tz_name)
dts = sorted(
    datetime.strptime(r_, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC).astimezone(tz)
    for r_ in rows
)
if not dts:
    print("No timestamped stars found.")
    sys.exit(0)

tzabbr = dts[-1].strftime("%Z") or tz_name
now = datetime.now(tz)
print(f"\n{repo} — {len(dts)} stars (with timestamps)")
print(f"newest: {dts[-1]:%Y-%m-%d %I:%M %p} {tzabbr}   |   now: {now:%Y-%m-%d %I:%M %p} {tzabbr}\n")


def bar(n: int, mx: int, w: int = 40) -> str:
    return "█" * round(n / mx * w) if mx else ""


days = Counter(d.strftime("%Y-%m-%d") for d in dts)
recent = sorted(days)[-days_n:]
mx = max(days[d] for d in recent)
peak = max(recent, key=lambda d: days[d])
print(f"STARS BY DAY ({tzabbr})")
for d in recent:
    tag = "  ← peak" if d == peak else ""
    print(f"  {d}  {days[d]:>4}  {bar(days[d], mx)}{tag}")

for day in sorted({d.strftime("%Y-%m-%d") for d in dts})[-hours_days:]:
    hrs = Counter(d.hour for d in dts if d.strftime("%Y-%m-%d") == day)
    mx = max(hrs.values())
    print(f"\nSTARS BY HOUR — {day} ({tzabbr})   total {sum(hrs.values())}")
    for h in range(24):
        if hrs[h]:
            print(f"  {h:02d}:00  {hrs[h]:>3}  {bar(hrs[h], mx, 30)}")
