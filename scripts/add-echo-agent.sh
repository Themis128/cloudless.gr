#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

echo "==> Adding EchoAgent as a second Cloudflare Agent"

echo "==> Backing up files..."
cp wrangler.jsonc "wrangler.jsonc.bak-echo-agent-$(date +%Y%m%d-%H%M%S)"
cp src/index.ts "src/index.ts.bak-echo-agent-$(date +%Y%m%d-%H%M%S)"

echo "==> Creating src/agents/echo.ts..."

mkdir -p src/agents

python3 - <<'PY'
from pathlib import Path

lt = chr(60)
gt = chr(62)

content = f'''import {{ Agent, callable }} from "agents";

export type EchoState = {{
  lastMessage: string;
  count: number;
}};

export class EchoAgent extends Agent{lt}Env, EchoState{gt} {{
  initialState: EchoState = {{
    lastMessage: "",
    count: 0,
  }};

  @callable()
  getState() {{
    return {{
      lastMessage: this.state?.lastMessage ?? "",
      count: this.state?.count ?? 0,
    }};
  }}

  @callable()
  echo(message: string) {{
    const nextState = {{
      lastMessage: message,
      count: (this.state?.count ?? 0) + 1,
    }};

    this.setState(nextState);

    return nextState;
  }}

  @callable()
  reset() {{
    const nextState = {{
      lastMessage: "",
      count: 0,
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

    if (url.pathname.endsWith("/echo")) {{
      const message = url.searchParams.get("message") ?? "hello";

      return Response.json({{
        ok: true,
        ...this.echo(message),
      }});
    }}

    return Response.json({{
      ok: true,
      agent: "EchoAgent",
      routes: {{
        status: "/api/agents/echo-agent/default/status",
        echo: "/api/agents/echo-agent/default/echo?message=hello",
        reset: "/api/agents/echo-agent/default/reset",
      }},
    }});
  }}
}}
'''

Path("src/agents/echo.ts").write_text(content)
PY

echo "==> Updating wrangler.jsonc with EchoAgent binding and v2 migration..."

python3 - <<'PY'
from pathlib import Path
import json

p = Path("wrangler.jsonc")
data = json.loads(p.read_text())

bindings = data.setdefault("durable_objects", {}).setdefault("bindings", [])

if not any(b.get("class_name") == "EchoAgent" for b in bindings):
    bindings.append({
        "name": "EchoAgent",
        "class_name": "EchoAgent"
    })

migrations = data.setdefault("migrations", [])

if not any("EchoAgent" in m.get("new_sqlite_classes", []) for m in migrations):
    existing_tags = {m.get("tag") for m in migrations}
    tag = "v2"
    i = 2

    while tag in existing_tags:
        i += 1
        tag = f"v{i}"

    migrations.append({
        "tag": tag,
        "new_sqlite_classes": ["EchoAgent"]
    })

p.write_text(json.dumps(data, indent=2) + "\n")
PY

echo "==> Updating src/index.ts export for EchoAgent..."

python3 - <<'PY'
from pathlib import Path

p = Path("src/index.ts")
text = p.read_text()

export_line = 'export { EchoAgent } from "./agents/echo";'

if export_line not in text:
    lines = text.splitlines()
    insert_at = 0

    for i, line in enumerate(lines):
        if line.startswith("export ") and "CounterAgent" in line:
            insert_at = i + 1
            break

    lines.insert(insert_at, export_line)
    text = "\n".join(lines) + "\n"

p.write_text(text)
PY

echo "==> Regenerating types and checking TypeScript..."
pnpm run cf:types
pnpm run cf:typecheck

echo
echo "✅ EchoAgent added."
echo
echo "Local test:"
echo "  lsof -ti :8787 | xargs -r kill -9"
echo "  pnpm run cf:dev"
echo
echo "In another terminal:"
echo "  TOKEN=\"\$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)\""
echo "  curl -i http://localhost:8787/api/agents/echo-agent/default/status"
echo "  curl -i -H \"Authorization: Bearer \$TOKEN\" \"http://localhost:8787/api/agents/echo-agent/default/echo?message=hello\""
echo "  curl -i -H \"Authorization: Bearer \$TOKEN\" http://localhost:8787/api/agents/echo-agent/default/status"
echo
echo "Deploy:"
echo "  pnpm run cf:deploy"
