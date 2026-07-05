#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

echo "==> Finishing CodingAgent agentic-coding setup"
echo "==> Features:"
echo "    1. Better output quality"
echo "    2. Review mode"
echo "    3. Patch proposal mode"
echo "    4. Durable lifecycle state"
echo "    5. Compact repo-context scripts"

echo "==> Backing up files..."
cp src/agents/coding.ts "src/agents/coding.ts.bak-agentic-finish-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
cp scripts/coding-agent-review-repo.sh "scripts/coding-agent-review-repo.sh.bak-agentic-finish-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true

echo "==> Writing improved src/agents/coding.ts..."

python3 - <<'PY'
from pathlib import Path

lt = chr(60)
gt = chr(62)

content = f'''import {{ Agent, callable }} from "agents";

export type CodingStatus = "idle" | "running" | "done" | "failed";
export type CodingMode = "review" | "patch";

export type CodingState = {{
  lastPrompt: string;
  lastResponse: string;
  count: number;
  updatedAt: string;
  status: CodingStatus;
  mode: CodingMode;
  error: string;
}};

function cleanModelText(text: string): string {{
  const thinkEnd = text.lastIndexOf("</think>");

  if (thinkEnd >= 0) {{
    text = text.slice(thinkEnd + "</think>".length);
  }}

  return text.trim();
}}

function extractText(result: unknown): string {{
  let text: string;

  if (typeof result === "string") {{
    text = result;
  }} else if (result && typeof result === "object") {{
    const value = result as Record<string, unknown>;

    if (typeof value.response === "string") {{
      text = value.response;
    }} else if (typeof value.text === "string") {{
      text = value.text;
    }} else if (typeof value.result === "string") {{
      text = value.result;
    }} else {{
      text = JSON.stringify(result, null, 2);
    }}
  }} else {{
    text = JSON.stringify(result, null, 2);
  }}

  return cleanModelText(text);
}}

function nowIso() {{
  return new Date().toISOString();
}}

function normalizeMode(value: string | null | undefined): CodingMode {{
  return value === "patch" ? "patch" : "review";
}}

function buildSystemPrompt(mode: CodingMode): string {{
  const shared = [
    "You are CodingAgent for the cloudless.gr project.",
    "The project is a TypeScript Cloudflare Workers + Cloudflare Agents SDK application.",
    "The Worker uses Durable Object Agents, routeAgentRequest(), Workers AI, Static Assets, and Bearer-token auth.",
    "Use ONLY the repository context provided in the user task.",
    "Do not assume Express.js, Node HTTP servers, Vercel routing, wrangler.toml, or files that are not shown.",
    "If a claim cannot be verified from the provided context, say so explicitly.",
    "If something is already implemented in the provided code, say it is implemented.",
    "Do not claim that you executed commands, edited files, deployed code, inspected files outside the prompt, or accessed a shell.",
    "You are in planning/suggestion mode only.",
    "Do not include <think>, hidden reasoning, chain-of-thought, or internal analysis.",
    "Prefer TypeScript, Cloudflare Workers, Durable Objects, Workers AI, and secure defaults.",
  ];

  if (mode === "patch") {{
    return [
      ...shared,
      "",
      "Return a patch proposal only. Use this exact structure:",
      "1. Summary",
      "2. Evidence from repository context",
      "3. Proposed changes",
      "4. Unified diff patch",
      "5. Commands to run",
      "6. Verification plan",
      "7. Risks and rollback",
      "",
      "Rules for patch proposals:",
      "- Only propose edits to files shown in the repository context.",
      "- If you cannot produce a safe patch from the evidence, say so and explain what context is missing.",
      "- Use unified diff format in section 4.",
      "- Do not invent file paths.",
      "- Do not include secrets.",
    ].join("\\n");
  }}

  return [
    ...shared,
    "",
    "Return a concise repository-aware review. Use this exact structure:",
    "1. Summary",
    "2. Evidence from repository context",
    "3. Findings",
    "4. Recommended changes",
    "5. Commands to run",
    "6. Risks / cautions",
    "",
    "Rules for reviews:",
    "- Reference exact files, constants, functions, routes, or bindings from the repository context.",
    "- Do not produce generic warnings that contradict the provided code.",
    "- Prefer concrete next actions over broad advice.",
  ].join("\\n");
}}

export class CodingAgent extends Agent{lt}Env, CodingState{gt} {{
  initialState: CodingState = {{
    lastPrompt: "",
    lastResponse: "",
    count: 0,
    updatedAt: "",
    status: "idle",
    mode: "review",
    error: "",
  }};

  @callable()
  getState() {{
    return {{
      lastPrompt: this.state?.lastPrompt ?? "",
      lastResponse: this.state?.lastResponse ?? "",
      count: this.state?.count ?? 0,
      updatedAt: this.state?.updatedAt ?? "",
      status: this.state?.status ?? "idle",
      mode: this.state?.mode ?? "review",
      error: this.state?.error ?? "",
    }};
  }}

  @callable()
  getResult() {{
    return this.getState();
  }}

  @callable()
  reset() {{
    const nextState: CodingState = {{
      lastPrompt: "",
      lastResponse: "",
      count: 0,
      updatedAt: nowIso(),
      status: "idle",
      mode: "review",
      error: "",
    }};

    this.setState(nextState);

    return nextState;
  }}

  private setRunning(prompt: string, mode: CodingMode) {{
    const nextState: CodingState = {{
      lastPrompt: prompt,
      lastResponse: this.state?.lastResponse ?? "",
      count: this.state?.count ?? 0,
      updatedAt: nowIso(),
      status: "running",
      mode,
      error: "",
    }};

    this.setState(nextState);

    return nextState;
  }}

  private setDone(prompt: string, mode: CodingMode, responseText: string) {{
    const nextState: CodingState = {{
      lastPrompt: prompt,
      lastResponse: responseText,
      count: (this.state?.count ?? 0) + 1,
      updatedAt: nowIso(),
      status: "done",
      mode,
      error: "",
    }};

    this.setState(nextState);

    return nextState;
  }}

  private setFailed(prompt: string, mode: CodingMode, error: unknown) {{
    const message = error instanceof Error ? error.message : String(error);

    const nextState: CodingState = {{
      lastPrompt: prompt,
      lastResponse: this.state?.lastResponse ?? "",
      count: this.state?.count ?? 0,
      updatedAt: nowIso(),
      status: "failed",
      mode,
      error: message,
    }};

    this.setState(nextState);

    return nextState;
  }}

  async runCodingTask(prompt: string, mode: CodingMode = "review") {{
    this.setRunning(prompt, mode);

    try {{
      const systemPrompt = buildSystemPrompt(mode);

      const result = await this.env.AI.run(
        "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        {{
          prompt: systemPrompt + "\\n\\nUser task and repository context:\\n" + prompt,
        }}
      );

      const responseText = extractText(result);

      return this.setDone(prompt, mode, responseText);
    }} catch (error) {{
      return this.setFailed(prompt, mode, error);
    }}
  }}

  async onRequest(request: Request): Promise{lt}Response{gt} {{
    const url = new URL(request.url);

    if (url.pathname.endsWith("/status")) {{
      const state = this.getState();

      return Response.json({{
        ok: true,
        lastPrompt: state.lastPrompt,
        count: state.count,
        updatedAt: state.updatedAt,
        status: state.status,
        mode: state.mode,
        error: state.error,
      }});
    }}

    if (url.pathname.endsWith("/result")) {{
      return Response.json({{
        ok: true,
        ...this.getResult(),
      }});
    }}

    if (url.pathname.endsWith("/reset")) {{
      return Response.json({{
        ok: true,
        ...this.reset(),
      }});
    }}

    if (url.pathname.endsWith("/patch")) {{
      let prompt = url.searchParams.get("prompt") ?? "";

      if (request.method === "POST") {{
        try {{
          const body = await request.json() as {{ prompt?: string }};
          prompt = body.prompt ?? prompt;
        }} catch {{
          // Ignore malformed JSON and fall back to query string.
        }}
      }}

      if (!prompt.trim()) {{
        return Response.json(
          {{
            ok: false,
            error: "Missing prompt",
            example: "/api/agents/coding-agent/default/patch?prompt=Propose%20a%20safe%20patch",
          }},
          {{
            status: 400,
          }}
        );
      }}

      const result = await this.runCodingTask(prompt, "patch");

      return Response.json({{
        ok: result.status !== "failed",
        ...result,
      }});
    }}

    if (url.pathname.endsWith("/task")) {{
      let prompt = url.searchParams.get("prompt") ?? "";
      let mode = normalizeMode(url.searchParams.get("mode"));

      if (request.method === "POST") {{
        try {{
          const body = await request.json() as {{ prompt?: string; mode?: string }};
          prompt = body.prompt ?? prompt;
          mode = normalizeMode(body.mode ?? mode);
        }} catch {{
          // Ignore malformed JSON and fall back to query string.
        }}
      }}

      if (!prompt.trim()) {{
        return Response.json(
          {{
            ok: false,
            error: "Missing prompt",
            example: "/api/agents/coding-agent/default/task?prompt=Review%20my%20Worker%20routing",
          }},
          {{
            status: 400,
          }}
        );
      }}

      const result = await this.runCodingTask(prompt, mode);

      return Response.json({{
        ok: result.status !== "failed",
        ...result,
      }});
    }}

    return Response.json({{
      ok: true,
      agent: "CodingAgent",
      routes: {{
        status: "/api/agents/coding-agent/default/status",
        task: "/api/agents/coding-agent/default/task?prompt=Review%20my%20Worker%20routing",
        patch: "/api/agents/coding-agent/default/patch?prompt=Propose%20a%20safe%20patch",
        result: "/api/agents/coding-agent/default/result",
        reset: "/api/agents/coding-agent/default/reset",
      }},
    }});
  }}
}}
'''

Path("src/agents/coding.ts").write_text(content)
PY

echo "==> Writing compact repo-context review script..."

cat > scripts/coding-agent-review-repo.sh <<'SCRIPT'
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
SCRIPT

chmod +x scripts/coding-agent-review-repo.sh

echo "==> Writing patch proposal wrapper..."

cat > scripts/coding-agent-propose-patch.sh <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://cloudless-gr.baltzakis-themis.workers.dev}"

export REVIEW_MODE="patch"
export MAX_FILE_CHARS="${MAX_FILE_CHARS:-12000}"

exec /home/tbaltzakis/cloudless.gr/scripts/coding-agent-review-repo.sh "$BASE_URL"
SCRIPT

chmod +x scripts/coding-agent-propose-patch.sh

echo "==> Running checks..."
pnpm run cf:types
pnpm run cf:typecheck

echo
echo "✅ Finished CodingAgent agentic-coding setup."
echo
echo "Local review:"
echo "  scripts/coding-agent-review-repo.sh http://localhost:8787"
echo
echo "Local patch proposal:"
echo "  scripts/coding-agent-propose-patch.sh http://localhost:8787"
echo
echo "Production review:"
echo "  scripts/coding-agent-review-repo.sh https://cloudless-gr.baltzakis-themis.workers.dev"
echo
echo "Production patch proposal:"
echo "  scripts/coding-agent-propose-patch.sh https://cloudless-gr.baltzakis-themis.workers.dev"
echo
echo "Deploy:"
echo "  pnpm run cf:deploy"
