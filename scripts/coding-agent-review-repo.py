#!/usr/bin/env python3
"""CodingAgent repo review — packages the worker source files +
compact package.json/types summary, POSTs it to the CodingAgent
task endpoint, then fetches the saved result.

Usage: python3 scripts/coding-agent-review-repo.py [BASE_URL]
Env: REVIEW_MODE (review|patch), MAX_FILE_CHARS (default 12000)"""

import json
import os
import sys
import urllib.request
from pathlib import Path

PROJECT_DIR = Path("/home/tbaltzakis/cloudless.gr")
os.chdir(PROJECT_DIR)

BASE_URL = (sys.argv[1] if len(sys.argv) > 1
            else "https://cloudless-gr."
                 "baltzakis-themis.workers.dev")
REVIEW_MODE = os.environ.get("REVIEW_MODE", "review")
MAX_FILE_CHARS = int(os.environ.get("MAX_FILE_CHARS", "12000"))

token = ""
env_file = PROJECT_DIR / ".env.local"
if env_file.is_file():
    for line in env_file.read_text().splitlines():
        if line.startswith("AGENT_AUTH_TOKEN="):
            token = line.split("=", 1)[1].strip()
if not token:
    sys.exit("Missing AGENT_AUTH_TOKEN in .env.local")

SOURCE_FILES = [
    "src/index.ts",
    "src/agents/coding.ts",
    "src/agents/counter.ts",
    "src/agents/echo.ts",
    "wrangler.jsonc",
    "tsconfig.worker.json",
]

sections: list[str] = []
for rel in SOURCE_FILES:
    path = PROJECT_DIR / rel
    if not path.exists():
        sections.append(f"## FILE: {rel}\nMISSING\n")
        continue
    text = path.read_text(errors="replace")
    if len(text) > MAX_FILE_CHARS:
        text = text[:MAX_FILE_CHARS] + "\n\n[TRUNCATED]\n"
    sections.append(f"## FILE: {rel}\n--- BEGIN FILE ---\n"
                    f"{text}\n--- END FILE ---\n")

package_path = PROJECT_DIR / "package.json"
if package_path.exists():
    package = json.loads(package_path.read_text())
    summary = {
        "name": package.get("name"),
        "version": package.get("version"),
        "packageManager": package.get("packageManager"),
        "scripts": {
            k: v for k, v in
            package.get("scripts", {}).items()
            if k.startswith("cf:")
            or k in ("dev", "build", "start", "typecheck",
                     "test", "deploy")},
        "selectedDependencies": {
            k: v for k, v in
            package.get("dependencies", {}).items()
            if k in ("agents", "hono-agents", "next", "react",
                     "react-dom", "openai",
                     "@anthropic-ai/sdk")},
        "selectedDevDependencies": {
            k: v for k, v in
            package.get("devDependencies", {}).items()
            if k in ("wrangler", "typescript",
                     "@cloudflare/workers-types", "vite",
                     "vitest", "tsx")},
    }
    sections.append(
        "## FILE: package.json compact summary\n"
        "--- BEGIN FILE ---\n"
        + json.dumps(summary, indent=2)
        + "\n--- END FILE ---\n")

worker_types = PROJECT_DIR / "worker-configuration.d.ts"
if worker_types.exists():
    lines = worker_types.read_text(errors="replace")\
        .splitlines()
    interesting, keep = [], False
    for line in lines:
        if "interface __BaseEnv_Env" in line:
            keep = True
        if keep:
            interesting.append(line)
        if keep and line.strip() == "}":
            break
    sections.append(
        "## FILE: worker-configuration.d.ts compact Env "
        "summary\n--- BEGIN FILE ---\n"
        + "\n".join(interesting[:120])
        + "\n--- END FILE ---\n")

if REVIEW_MODE == "patch":
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

payload = {"prompt": prompt, "mode": REVIEW_MODE}
body = json.dumps(payload).encode()
print(f"==> Payload size:\n{len(body)} ")

print("\n==> Preview files included:")
for marker in [
        "## FILE: src/index.ts",
        "## FILE: src/agents/coding.ts",
        "## FILE: src/agents/counter.ts",
        "## FILE: src/agents/echo.ts",
        "## FILE: wrangler.jsonc",
        "## FILE: tsconfig.worker.json",
        "## FILE: package.json compact summary",
        "## FILE: worker-configuration.d.ts compact Env summary"]:
    print(marker, "=>", marker in prompt)
print(f"\nMode: {REVIEW_MODE}")
print(f"Prompt length: {len(prompt)}\n")
print("First 1500 chars of prompt:")
print(prompt[:1500])


def send(url: str, method: str = "GET",
         data: bytes | None = None) -> None:
    headers = {"Authorization": f"Bearer {token}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, method=method,
                                 data=data, headers=headers)
    try:
        r = urllib.request.urlopen(req, timeout=120)
        print(f"\nHTTP {r.status}")
        print(r.read().decode(errors="replace"))
    except Exception as e:
        import urllib.error
        if isinstance(e, urllib.error.HTTPError):
            print(f"\nHTTP {e.code}")
            print(e.read().decode(errors="replace"))
        else:
            print(f"\nERR {e}")


print("\n==> Sending compact repo-context task to "
      "CodingAgent...")
print(f"==> Base URL: {BASE_URL}")
print(f"==> Mode: {REVIEW_MODE}")
send(f"{BASE_URL}/api/agents/coding-agent/default/task",
     method="POST", data=body)

print("\n\n==> Fetching saved result...")
send(f"{BASE_URL}/api/agents/coding-agent/default/result")
