#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

echo "==> Adding CodingAgent with Workers AI"

echo "==> Backing up files..."
cp wrangler.jsonc "wrangler.jsonc.bak-coding-agent-$(date +%Y%m%d-%H%M%S)"
cp src/index.ts "src/index.ts.bak-coding-agent-$(date +%Y%m%d-%H%M%S)"

echo "==> Creating src/agents/coding.ts..."

mkdir -p src/agents

python3 - <<'PY'
from pathlib import Path

lt = chr(60)
gt = chr(62)

content = f'''import {{ Agent, callable }} from "agents";

export type CodingState = {{
  lastPrompt: string;
  lastResponse: string;
  count: number;
  updatedAt: string;
}};

function extractText(result: unknown): string {{
  if (typeof result === "string") {{
    return result;
  }}

  if (result && typeof result === "object") {{
    const value = result as Record<string, unknown>;

    if (typeof value.response === "string") {{
      return value.response;
    }}

    if (typeof value.text === "string") {{
      return value.text;
    }}

    if (typeof value.result === "string") {{
      return value.result;
    }}
  }}

  return JSON.stringify(result, null, 2);
}}

export class CodingAgent extends Agent{lt}Env, CodingState{gt} {{
  initialState: CodingState = {{
    lastPrompt: "",
    lastResponse: "",
    count: 0,
    updatedAt: "",
  }};

  @callable()
  getState() {{
    return {{
      lastPrompt: this.state?.lastPrompt ?? "",
      lastResponse: this.state?.lastResponse ?? "",
      count: this.state?.count ?? 0,
      updatedAt: this.state?.updatedAt ?? "",
    }};
  }}

  @callable()
  reset() {{
    const nextState = {{
      lastPrompt: "",
      lastResponse: "",
      count: 0,
      updatedAt: new Date().toISOString(),
    }};

    this.setState(nextState);

    return nextState;
  }}

  async runCodingTask(prompt: string) {{
    const systemPrompt = [
      "You are CodingAgent for the cloudless.gr project.",
      "You help with safe agentic coding.",
      "Do not claim that you executed commands or changed files.",
      "Return a practical plan, risks, and suggested patch/commands where appropriate.",
      "Prefer TypeScript, Cloudflare Workers, Durable Objects, and secure defaults."
    ].join("\\n");

    const result = await this.env.AI.run(
      "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
      {{
        prompt: systemPrompt + "\\n\\nUser task:\\n" + prompt,
      }}
    );

    const responseText = extractText(result);

    const nextState = {{
      lastPrompt: prompt,
      lastResponse: responseText,
      count: (this.state?.count ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    }};

    this.setState(nextState);

    return nextState;
  }}

  async onRequest(request: Request): Promise{lt}Response{gt} {{
    const url = new URL(request.url);

    if (url.pathname.endsWith("/status")) {{
      return Response.json({{
        ok: true,
        ...this.getState(),
      }});
    }}

    if (url.pathname.endsWith("/reset")) {{
      return Response.json({{
        ok: true,
        ...this.reset(),
      }});
    }}

    if (url.pathname.endsWith("/task")) {{
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
            example: "/api/agents/coding-agent/default/task?prompt=Review%20my%20Worker%20routing",
          }},
          {{
            status: 400,
          }}
        );
      }}

      const result = await this.runCodingTask(prompt);

      return Response.json({{
        ok: true,
        ...result,
      }});
    }}

    return Response.json({{
      ok: true,
      agent: "CodingAgent",
      routes: {{
        status: "/api/agents/coding-agent/default/status",
        task: "/api/agents/coding-agent/default/task?prompt=Review%20my%20Worker%20routing",
        reset: "/api/agents/coding-agent/default/reset",
      }},
    }});
  }}
}}
'''

Path("src/agents/coding.ts").write_text(content)
PY

echo "==> Updating wrangler.jsonc with AI binding, CodingAgent binding, and migration..."

python3 - <<'PY'
from pathlib import Path
import json

p = Path("wrangler.jsonc")
data = json.loads(p.read_text())

data["ai"] = {
    "binding": "AI"
}

bindings = data.setdefault("durable_objects", {}).setdefault("bindings", [])

if not any(b.get("class_name") == "CodingAgent" for b in bindings):
    bindings.append({
        "name": "CodingAgent",
        "class_name": "CodingAgent"
    })

migrations = data.setdefault("migrations", [])

if not any("CodingAgent" in m.get("new_sqlite_classes", []) for m in migrations):
    existing_tags = {m.get("tag") for m in migrations}
    i = 3
    tag = f"v{i}"

    while tag in existing_tags:
        i += 1
        tag = f"v{i}"

    migrations.append({
        "tag": tag,
        "new_sqlite_classes": ["CodingAgent"]
    })

p.write_text(json.dumps(data, indent=2) + "\n")
PY

echo "==> Updating src/index.ts export for CodingAgent..."

python3 - <<'PY'
from pathlib import Path

p = Path("src/index.ts")
text = p.read_text()

export_line = 'export { CodingAgent } from "./agents/coding";'

if export_line not in text:
    lines = text.splitlines()
    insert_at = 0

    for i, line in enumerate(lines):
        if line.startswith("export ") and "EchoAgent" in line:
            insert_at = i + 1
            break
        if line.startswith("export ") and "CounterAgent" in line:
            insert_at = i + 1

    lines.insert(insert_at, export_line)
    text = "\n".join(lines) + "\n"

p.write_text(text)
PY

echo "==> Regenerating types and checking TypeScript..."
pnpm run cf:types
pnpm run cf:typecheck

echo
echo "✅ CodingAgent with Workers AI added."
echo
echo "Local test:"
echo "  lsof -ti :8787 | xargs -r kill -9"
echo "  pnpm run cf:dev"
echo
echo "In another terminal:"
echo "  TOKEN=\"\$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)\""
echo "  curl -i http://localhost:8787/api/agents/coding-agent/default/status"
echo "  curl -i -H \"Authorization: Bearer \$TOKEN\" \"http://localhost:8787/api/agents/coding-agent/default/task?prompt=Review%20my%20Cloudflare%20Worker%20routing\""
echo
echo "Deploy:"
echo "  pnpm run cf:deploy"
