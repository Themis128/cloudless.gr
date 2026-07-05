#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

BASE_URL="${1:-https://cloudless-gr.baltzakis-themis.workers.dev}"
PATCH_DIR="patches/coding-agent"

TOKEN="$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)"

if [ -z "$TOKEN" ]; then
  echo "Missing AGENT_AUTH_TOKEN in .env.local"
  exit 1
fi

mkdir -p "$PATCH_DIR"

TMP_RESULT="$(mktemp)"
trap 'rm -f "$TMP_RESULT"' EXIT

curl -fsS \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/agents/coding-agent/default/result" \
  > "$TMP_RESULT"

python3 - "$TMP_RESULT" "$PATCH_DIR" <<'PY'
from pathlib import Path
import json
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

result_path = Path(sys.argv[1])
patch_dir = Path(sys.argv[2])
repo = Path.cwd()

payload = json.loads(result_path.read_text())
last_response = payload.get("lastResponse", "")

if not last_response.strip():
    raise SystemExit("No lastResponse found.")

try:
    structured_patch = json.loads(last_response)
except json.JSONDecodeError as exc:
    raise SystemExit(f"lastResponse is not valid structured patch JSON: {exc}")

safe_to_apply = structured_patch.get("safeToApply")
unified_diff = structured_patch.get("unifiedDiff", "")

if safe_to_apply is not True:
    print("Refusing to save patch because safeToApply is not true.")
    print()
    print("Summary:")
    print(structured_patch.get("summary", ""))
    raise SystemExit(2)

if not isinstance(unified_diff, str) or not unified_diff.strip():
    raise SystemExit("Refusing to save patch because unifiedDiff is empty.")

bad_paths = []

for line in unified_diff.splitlines():
    if line.startswith("--- ") or line.startswith("+++ "):
        raw = line[4:].split("\t", 1)[0].strip()

        if raw == "/dev/null":
            bad_paths.append(raw)
            continue

        if raw.startswith("a/") or raw.startswith("b/"):
            rel = raw[2:]
        else:
            rel = raw

        path = (repo / rel).resolve()

        try:
            path.relative_to(repo.resolve())
        except ValueError:
            bad_paths.append(raw)
            continue

        if not path.exists():
            bad_paths.append(raw)

if bad_paths:
    print("Refusing to save patch because these paths are invalid or missing:")
    for path in bad_paths:
        print(f"- {path}")
    raise SystemExit(3)

with tempfile.NamedTemporaryFile("w", suffix=".patch", delete=False) as tmp:
    tmp.write(unified_diff.rstrip() + "\n")
    tmp_patch = Path(tmp.name)

try:
    check = subprocess.run(
        ["git", "apply", "--check", str(tmp_patch)],
        cwd=repo,
        text=True,
        capture_output=True,
        check=False,
    )

    if check.returncode != 0:
        print("Refusing to save patch because git apply --check failed.")
        print()
        print("git apply --check stderr:")
        print(check.stderr.strip())
        raise SystemExit(4)
finally:
    tmp_patch.unlink(missing_ok=True)

timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
patch_file = patch_dir / f"{timestamp}.patch"
json_file = patch_dir / f"{timestamp}.json"

patch_file.write_text(unified_diff.rstrip() + "\n")
json_file.write_text(json.dumps(structured_patch, indent=2) + "\n")

print(f"Saved patch: {patch_file}")
print(f"Saved metadata: {json_file}")
print()
print("Next commands:")
print(f"  git apply --check {patch_file}")
print(f"  git apply {patch_file}")
print("  pnpm run cf:typecheck")
PY
