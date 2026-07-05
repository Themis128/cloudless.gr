#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

BASE_URL="${1:-https://cloudless-gr.baltzakis-themis.workers.dev}"
REVIEW_MODE="${REVIEW_MODE:-review}"
MAX_FILE_CHARS="${MAX_FILE_CHARS:-12000}"

TOKEN="$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)"

if [ -z "$TOKEN" ]; then
  echo "Missing AGENT_AUTH_TOKEN in .env.local"
  exit 1
fi

export PROJECT_DIR
export MAX_FILE_CHARS
export REVIEW_MODE

python3 - <<'PY' > /tmp/coding-agent-review-payload.json
from pathlib import Path
import json
import os

project_dir = Path(os.environ["PROJECT_DIR"])
max_file_chars = int(os.environ.get("MAX_FILE_CHARS", "12000"))
review_mode = os.environ.get("REVIEW_MODE", "review")

source_files = [
    "src/index.ts",
    "src/agents/coding.ts",
    "src/agents/counter.ts",
    "src/agents/echo.ts",
    "wrangler.jsonc",
    "tsconfig.worker.json",
]

sections = []

def add_file(rel: str):
    path = project_dir / rel

    if not path.exists():
        sections.append(f"## FILE: {rel}\nMISSING\n")
        return

    text = path.read_text(errors="replace")

    if len(text) > max_file_chars:
        text = text[:max_file_chars] + "\n\n[TRUNCATED]\n"

    sections.append(
        f"## FILE: {rel}\n"
        f"--- BEGIN FILE ---\n"
        f"{text}\n"
        f"--- END FILE ---\n"
    )

for rel in source_files:
    add_file(rel)

package_path = project_dir / "package.json"

if package_path.exists():
    package = json.loads(package_path.read_text())

    package_summary = {
        "name": package.get("name"),
        "version": package.get("version"),
        "packageManager": package.get("packageManager"),
        "scripts": {
            key: value
            for key, value in package.get("scripts", {}).items()
            if key.startswith("cf:")
            or key in ["dev", "build", "start", "typecheck", "test", "deploy"]
        },
        "selectedDependencies": {
            key: value
            for key, value in package.get("dependencies", {}).items()
            if key in ["agents", "hono-agents", "next", "react", "react-dom", "openai", "@anthropic-ai/sdk"]
        },
        "selectedDevDependencies": {
            key: value
            for key, value in package.get("devDependencies", {}).items()
            if key in ["wrangler", "typescript", "@cloudflare/workers-types", "vite", "vitest", "tsx"]
        },
    }

    sections.append(
        "## FILE: package.json compact summary\n"
        "--- BEGIN FILE ---\n"
        + json.dumps(package_summary, indent=2)
        + "\n--- END FILE ---\n"
    )

worker_types = project_dir / "worker-configuration.d.ts"

if worker_types.exists():
    text = worker_types.read_text(errors="replace")
    lines = text.splitlines()

    interesting = []
    keep = False

    for line in lines:
        if "interface __BaseEnv_Env" in line:
            keep = True

        if keep:
            interesting.append(line)

        if keep and line.strip() == "}":
            break

    compact_types = "\n".join(interesting[:120])

    sections.append(
        "## FILE: worker-configuration.d.ts compact Env summary\n"
        "--- BEGIN FILE ---\n"
        + compact_types
        + "\n--- END FILE ---\n"
    )

if review_mode == "patch":
    task = """
Task:
Propose a safe patch based on the repository context.

Patch focus:
1. Improve correctness or clarity.
2. Keep the existing architecture.
3. Do not remove auth.
4. Do not expose secrets.
5. Prefer small, reviewable changes.

Allowed patch files:
- src/index.ts
- src/agents/coding.ts
- src/agents/counter.ts
- src/agents/echo.ts
- wrangler.jsonc
- tsconfig.worker.json
- package.json

Hard patch rules:
- Do not propose public/counter.ts.
- Do not propose files that are not listed above.
- Do not invent VITE_API_KEY, VITE_API_BASE_URL, or frontend environment variables unless shown in context.
- Do not create new files unless explicitly requested.
- If no safe patch is possible using only the allowed files, respond with NO_SAFE_PATCH.
"""
else:
    task = """
Task:
Review the repository context.

Review focus:
1. Worker route ordering
2. /api/agents prefix rewrite
3. Bearer auth coverage
4. Direct /agents path blocking
5. Static assets fallback
6. Workers AI binding
7. CounterAgent, EchoAgent, CodingAgent registration
8. Durable Object migrations
9. Production/deployment risks
10. Recommended next changes
"""

prompt = f"""
You are CodingAgent reviewing the actual cloudless.gr repository context.

Important:
- Use ONLY the repository context below.
- Do not assume Express.js, Vercel routing, wrangler.toml, or files that are not shown.
- The project uses Cloudflare Workers, Cloudflare Agents SDK, Durable Object Agents, Workers AI, Static Assets, and Bearer-token auth.
- Review the implementation as an agentic coding reviewer.
- Do not claim you executed commands or modified files.
- Be specific. Reference exact files and functions from the context.
- If something is already implemented, say it is implemented.
- Do not produce generic warnings that contradict the provided code.

{task}

Repository context:

{chr(10).join(sections)}
"""

print(json.dumps({"prompt": prompt, "mode": review_mode}))
PY

echo "==> Payload size:"
wc -c /tmp/coding-agent-review-payload.json

echo
echo "==> Preview files included:"
python3 - <<'PY'
import json

with open("/tmp/coding-agent-review-payload.json", "r") as f:
    payload = json.load(f)

prompt = payload["prompt"]

for marker in [
    "## FILE: src/index.ts",
    "## FILE: src/agents/coding.ts",
    "## FILE: src/agents/counter.ts",
    "## FILE: src/agents/echo.ts",
    "## FILE: wrangler.jsonc",
    "## FILE: tsconfig.worker.json",
    "## FILE: package.json compact summary",
    "## FILE: worker-configuration.d.ts compact Env summary",
]:
    print(marker, "=>", marker in prompt)

print()
print("Mode:", payload.get("mode"))
print("Prompt length:", len(prompt))
print()
print("First 1500 chars of prompt:")
print(prompt[:1500])
PY

echo
echo "==> Sending compact repo-context task to CodingAgent..."
echo "==> Base URL: $BASE_URL"
echo "==> Mode: $REVIEW_MODE"

curl -i \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/coding-agent-review-payload.json \
  "$BASE_URL/api/agents/coding-agent/default/task"

echo
echo
echo "==> Fetching saved result..."
curl -i \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/agents/coding-agent/default/result"

rm -f /tmp/coding-agent-review-payload.json
