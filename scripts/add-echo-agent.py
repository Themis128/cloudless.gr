#!/usr/bin/env python3
"""Add EchoAgent as a second Cloudflare Agent — writes
src/agents/echo.ts, registers the binding + migration in
wrangler.jsonc, exports it from src/index.ts, then typechecks."""

import json
import shutil
import subprocess
import time
from pathlib import Path

PROJECT_DIR = Path("/home/tbaltzakis/cloudless.gr")
import os
os.chdir(PROJECT_DIR)

print("==> Adding EchoAgent as a second Cloudflare Agent")

ts = time.strftime("%Y%m%d-%H%M%S")
print("==> Backing up files...")
shutil.copy("wrangler.jsonc", f"wrangler.jsonc.bak-echo-agent-{ts}")
shutil.copy("src/index.ts", f"src/index.ts.bak-echo-agent-{ts}")

print("==> Creating src/agents/echo.ts...")
Path("src/agents").mkdir(parents=True, exist_ok=True)
Path("src/agents/echo.ts").write_text('''import { Agent, callable } from "agents";

export type EchoState = {
  lastMessage: string;
  count: number;
};

export class EchoAgent extends Agent<Env, EchoState> {
  initialState: EchoState = {
    lastMessage: "",
    count: 0,
  };

  @callable()
  getState() {
    return {
      lastMessage: this.state?.lastMessage ?? "",
      count: this.state?.count ?? 0,
    };
  }

  @callable()
  echo(message: string) {
    const nextState = {
      lastMessage: message,
      count: (this.state?.count ?? 0) + 1,
    };

    this.setState(nextState);

    return nextState;
  }

  @callable()
  reset() {
    const nextState = {
      lastMessage: "",
      count: 0,
    };

    this.setState(nextState);

    return nextState;
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/status")) {
      return Response.json({
        ok: true,
        ...this.getState(),
      });
    }

    if (url.pathname.endsWith("/reset")) {
      return Response.json({
        ok: true,
        ...this.reset(),
      });
    }

    if (url.pathname.endsWith("/echo")) {
      const message = url.searchParams.get("message") ?? "hello";

      return Response.json({
        ok: true,
        ...this.echo(message),
      });
    }

    return Response.json({
      ok: true,
      agent: "EchoAgent",
      routes: {
        status: "/api/agents/echo-agent/default/status",
        echo: "/api/agents/echo-agent/default/echo?message=hello",
        reset: "/api/agents/echo-agent/default/reset",
      },
    });
  }
}
''')

print("==> Updating wrangler.jsonc with EchoAgent binding and "
      "v2 migration...")
p = Path("wrangler.jsonc")
data = json.loads(p.read_text())
bindings = data.setdefault("durable_objects", {})\
    .setdefault("bindings", [])
if not any(b.get("class_name") == "EchoAgent"
           for b in bindings):
    bindings.append({"name": "EchoAgent",
                     "class_name": "EchoAgent"})

migrations = data.setdefault("migrations", [])
if not any("EchoAgent" in m.get("new_sqlite_classes", [])
           for m in migrations):
    tags = {m.get("tag") for m in migrations}
    tag, i = "v2", 2
    while tag in tags:
        i += 1
        tag = f"v{i}"
    migrations.append({"tag": tag,
                       "new_sqlite_classes": ["EchoAgent"]})
p.write_text(json.dumps(data, indent=2) + "\n")

print("==> Updating src/index.ts export for EchoAgent...")
p = Path("src/index.ts")
text = p.read_text()
export_line = 'export { EchoAgent } from "./agents/echo";'
if export_line not in text:
    lines = text.splitlines()
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("export ") and \
                "CounterAgent" in line:
            insert_at = i + 1
            break
    lines.insert(insert_at, export_line)
    p.write_text("\n".join(lines) + "\n")

print("==> Regenerating types and checking TypeScript...")
subprocess.call(["pnpm", "run", "cf:types"])
subprocess.call(["pnpm", "run", "cf:typecheck"])

print("""
✅ EchoAgent added.

Local test:
  lsof -ti :8787 | xargs -r kill -9
  pnpm run cf:dev

In another terminal:
  TOKEN="$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)"
  curl -i http://localhost:8787/api/agents/echo-agent/default/status
  curl -i -H "Authorization: Bearer $TOKEN" "http://localhost:8787/api/agents/echo-agent/default/echo?message=hello"
  curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/agents/echo-agent/default/status

Deploy:
  pnpm run cf:deploy""")
