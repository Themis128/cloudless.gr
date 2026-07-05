#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

BASE_URL="${1:-https://cloudless-gr.baltzakis-themis.workers.dev}"
MAX_FILE_CHARS="${MAX_FILE_CHARS:-12000}"

TOKEN="$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)"

if [ -z "$TOKEN" ]; then
  echo "Missing AGENT_AUTH_TOKEN in .env.local"
  exit 1
fi

export PROJECT_DIR
export MAX_FILE_CHARS

python3 - <<'PY' > /tmp/coding-agent-structured-patch-payload.json
from pathlib import Path
import json
import os

project_dir = Path(os.environ["PROJECT_DIR"])
max_file_chars = int(os.environ.get("MAX_FILE_CHARS", "12000"))

files = [
    "src/index.ts",
    "src/agents/coding.ts",
    "src/agents/structured-patch.ts",
    "src/agents/counter.ts",
    "src/agents/echo.ts",
    "wrangler.jsonc",
    "tsconfig.worker.json",
]

sections = []

for rel in files:
    path = project_dir / rel

    if not path.exists():
        sections.append(f"## FILE: {rel}\nMISSING\n")
        continue

    text = path.read_text(errors="replace")

    if len(text) > max_file_chars:
        text = text[:max_file_chars] + "\n\n[TRUNCATED]\n"

    sections.append(
        f"## FILE: {rel}\n"
        f"--- BEGIN FILE ---\n"
        f"{text}\n"
        f"--- END FILE ---\n"
    )

prompt = f"""
Repository context:

{chr(10).join(sections)}

Task:
Produce a structured patch proposal.

Hard rules:
- Only propose changes to files shown above.
- If no safe patch is needed, set safeToApply=false.
- Do not invent packages, imports, files, environment variables, or framework APIs.
- For this project, Cloudflare Agents are imported from "agents".
- Do not use @cloudflare/workers-sdk.
- Prefer pnpm commands, not npm commands.
- The unifiedDiff must only reference existing files from the repository context.
"""

print(json.dumps({"prompt": prompt, "model": "deep"}))
PY

echo "==> Payload size:"
wc -c /tmp/coding-agent-structured-patch-payload.json

echo
echo "==> Sending structured patch request to CodingAgent..."
curl -i \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/coding-agent-structured-patch-payload.json \
  "$BASE_URL/api/agents/coding-agent/default/structured-patch"

rm -f /tmp/coding-agent-structured-patch-payload.json
