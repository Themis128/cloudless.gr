#!/usr/bin/env python3
"""Fetch the CodingAgent's last structured-patch response,
validate it (safeToApply, path safety, git apply --check), and
save it under patches/coding-agent/.

Usage: python3 scripts/coding-agent-save-structured-patch.py \
    [BASE_URL]"""

import json
import subprocess
import sys
import tempfile
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

PROJECT_DIR = Path("/home/tbaltzakis/cloudless.gr")
os = __import__("os")
os.chdir(PROJECT_DIR)

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "https://cloudless-gr.baltzakis-themis.workers.dev"
PATCH_DIR = Path("patches/coding-agent")

token = ""
env_file = PROJECT_DIR / ".env.local"
if env_file.is_file():
    for line in env_file.read_text().splitlines():
        if line.startswith("AGENT_AUTH_TOKEN="):
            token = line.split("=", 1)[1].strip()
if not token:
    sys.exit("Missing AGENT_AUTH_TOKEN in .env.local")

PATCH_DIR.mkdir(parents=True, exist_ok=True)

req = urllib.request.Request(
    f"{BASE_URL}/api/agents/coding-agent/default/result",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    payload = json.loads(urllib.request.urlopen(req, timeout=60).read())
except Exception as e:
    sys.exit(f"Failed to fetch result: {e}")

last_response = payload.get("lastResponse", "")
if not last_response.strip():
    sys.exit("No lastResponse found.")

try:
    structured_patch = json.loads(last_response)
except json.JSONDecodeError as e:
    sys.exit(f"lastResponse is not valid structured patch JSON: {e}")

if structured_patch.get("safeToApply") is not True:
    print("Refusing to save patch because safeToApply is not true.\n\nSummary:")
    print(structured_patch.get("summary", ""))
    sys.exit(2)

unified_diff = structured_patch.get("unifiedDiff", "")
if not isinstance(unified_diff, str) or not unified_diff.strip():
    sys.exit("Refusing to save patch because unifiedDiff is empty.")

bad = []
repo = PROJECT_DIR.resolve()
for line in unified_diff.splitlines():
    if line.startswith(("--- ", "+++ ")):
        raw = line[4:].split("\t", 1)[0].strip()
        if raw == "/dev/null":
            bad.append(raw)
            continue
        rel = raw[2:] if raw.startswith(("a/", "b/")) else raw
        path = (repo / rel).resolve()
        try:
            path.relative_to(repo)
        except ValueError:
            bad.append(raw)
            continue
        if not path.exists():
            bad.append(raw)
if bad:
    print("Refusing to save patch because these paths are invalid or missing:")
    for p in bad:
        print(f"- {p}")
    sys.exit(3)

with tempfile.NamedTemporaryFile("w", suffix=".patch", delete=False) as tmp:
    tmp.write(unified_diff.rstrip() + "\n")
    tmp_patch = Path(tmp.name)
try:
    check = subprocess.run(
        ["git", "apply", "--check", str(tmp_patch)], capture_output=True, text=True
    )
    if check.returncode != 0:
        print("Refusing to save patch because git apply --check failed.\n")
        print("git apply --check stderr:")
        print(check.stderr.strip())
        sys.exit(4)
finally:
    tmp_patch.unlink(missing_ok=True)

ts = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
patch_file = PATCH_DIR / f"{ts}.patch"
json_file = PATCH_DIR / f"{ts}.json"
patch_file.write_text(unified_diff.rstrip() + "\n")
json_file.write_text(json.dumps(structured_patch, indent=2) + "\n")

print(f"Saved patch: {patch_file}")
print(f"Saved metadata: {json_file}\n")
print(f"""Next commands:
  git apply --check {patch_file}
  git apply {patch_file}
  pnpm run cf:typecheck""")
