#!/usr/bin/env python3
"""Send a structured-patch request to the CodingAgent endpoint —
packages repo context and POSTs to
/api/agents/coding-agent/default/structured-patch.

Usage: python3 scripts/coding-agent-structured-patch.py \
    [BASE_URL]
Env: MAX_FILE_CHARS (default 12000)"""

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_DIR = Path("/home/tbaltzakis/cloudless.gr")
os.chdir(PROJECT_DIR)

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "https://cloudless-gr.baltzakis-themis.workers.dev"
MAX_FILE_CHARS = int(os.environ.get("MAX_FILE_CHARS", "12000"))

token = ""
env_file = PROJECT_DIR / ".env.local"
if env_file.is_file():
    for line in env_file.read_text().splitlines():
        if line.startswith("AGENT_AUTH_TOKEN="):
            token = line.split("=", 1)[1].strip()
if not token:
    sys.exit("Missing AGENT_AUTH_TOKEN in .env.local")

FILES = [
    "src/index.ts",
    "src/agents/coding.ts",
    "src/agents/structured-patch.ts",
    "src/agents/counter.ts",
    "src/agents/echo.ts",
    "wrangler.jsonc",
    "tsconfig.worker.json",
]

sections = []
for rel in FILES:
    path = PROJECT_DIR / rel
    if not path.exists():
        sections.append(f"## FILE: {rel}\nMISSING\n")
        continue
    text = path.read_text(errors="replace")
    if len(text) > MAX_FILE_CHARS:
        text = text[:MAX_FILE_CHARS] + "\n\n[TRUNCATED]\n"
    sections.append(f"## FILE: {rel}\n--- BEGIN FILE ---\n{text}\n--- END FILE ---\n")

prompt = f"""
Repository context:

{chr(10).join(sections)}

Task:
Produce a structured patch proposal.

Hard rules:
- Only propose changes to files shown above.
- If the requested capability is already implemented, set safeToApply=false.
- Prefer no patch over a speculative patch.
- Never set safeToApply=true unless unifiedDiff is non-empty, minimal, and git-apply compatible.
- unifiedDiff must be a raw unified diff that can pass git apply --check.
- Do not HTML-escape characters in unifiedDiff.
- Do not use &lt;, &gt;, or &amp; in unifiedDiff.
- Do not invent packages, imports, files, environment variables, commands, functions, classes, or framework APIs.
- Do not propose changes that depend on symbols not shown in repository context.
- For this project, Cloudflare Agents are imported from "agents".
- Do not use @cloudflare/workers-sdk.
- Do not add route handling that is already covered by routeAgentRequest() or rewriteAgentPrefix().
- commandsToRun must use existing project scripts only.
- Prefer pnpm commands, not npm commands.
- If unsure whether a patch applies cleanly, set safeToApply=false.
- The unifiedDiff must only reference existing files from the repository context.
- Every diff hunk must match the exact quoted source context.
"""

body = json.dumps({"prompt": prompt, "model": "deep"}).encode()
print(f"==> Payload size:\n{len(body)} bytes")

print("\n==> Sending structured patch request to CodingAgent...")
req = urllib.request.Request(
    f"{BASE_URL}/api/agents/coding-agent/default/structured-patch",
    data=body,
    method="POST",
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
)
try:
    r = urllib.request.urlopen(req, timeout=120)
    print(f"HTTP {r.status}")
    print(r.read().decode(errors="replace"))
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}")
    print(e.read().decode(errors="replace"))
