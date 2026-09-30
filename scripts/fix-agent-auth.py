#!/usr/bin/env python3
"""Fix Agent auth — ensures AGENT_AUTH_TOKEN in .env.local,
rewrites src/index.ts with Bearer auth, writes a token-aware
demo page, uploads the token as a Wrangler secret."""

import os
import secrets
import shutil
import subprocess
import time
from pathlib import Path

PROJECT_DIR = Path("/home/tbaltzakis/cloudless.gr")
os.chdir(PROJECT_DIR)
print(f"==> Project: {PROJECT_DIR}")

ts = time.strftime("%Y%m%d-%H%M%S")
print("==> Backing up files...")
shutil.copy("src/index.ts", f"src/index.ts.bak-agent-auth-{ts}")
for f in ("public/index.html", ".env.local"):
    if Path(f).is_file():
        shutil.copy(f, f"{f}.bak-agent-auth-{ts}")

print("==> Ensuring AGENT_AUTH_TOKEN exists once in .env.local...")
env_p = Path(".env.local")
token = None
if env_p.is_file():
    for line in env_p.read_text().splitlines():
        if line.startswith("AGENT_AUTH_TOKEN="):
            token = line.split("=", 1)[1]
if not token:
    token = secrets.token_urlsafe(36)

lines = (
    [ln for ln in env_p.read_text().splitlines() if not ln.startswith("AGENT_AUTH_TOKEN=")]
    if env_p.is_file()
    else []
)
lines += ["", f"AGENT_AUTH_TOKEN={token}"]
env_p.write_text("\n".join(lines) + "\n")

print("==> Writing authenticated Agent router to src/index.ts...")
Path("src/index.ts").write_text("""import { routeAgentRequest } from "agents";

export { CounterAgent } from "./agents/counter";

function unauthorized() {
  return Response.json(
    {
      ok: false,
      error: "Unauthorized",
    },
    {
      status: 401,
      headers: {
        "www-authenticate": 'Bearer realm="CounterAgent"',
      },
    }
  );
}

function isAuthorized(request: Request, env: Env) {
  const expectedToken = env.AGENT_AUTH_TOKEN;

  if (!expectedToken) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const token = authorization.slice("Bearer ".length).trim();

  return token === expectedToken;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const isAgentRoute = url.pathname.startsWith("/agents/");

    if (isAgentRoute && !isAuthorized(request, env)) {
      return unauthorized();
    }

    const agentResponse = await routeAgentRequest(request, env);

    if (agentResponse) {
      return agentResponse;
    }

    return env.ASSETS.fetch(request);
  },
};
""")

print("==> Writing token-aware vanilla JS frontend to public/index.html...")
Path("public").mkdir(exist_ok=True)
Path("public/index.html").write_text("""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Cloudless Agent Worker</title>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        max-width: 720px;
        margin: 48px auto;
        padding: 0 24px;
      }

      button {
        margin-right: 8px;
        padding: 8px 12px;
        cursor: pointer;
      }

      code {
        background: #f4f4f4;
        padding: 2px 6px;
        border-radius: 4px;
      }

      pre {
        background: #111;
        color: #0f0;
        padding: 16px;
        border-radius: 8px;
        overflow: auto;
      }
    </style>
  </head>
  <body>
    <h1>Cloudless Agent Worker</h1>

    <p>
      CounterAgent instance:
      <code>/agents/counter-agent/default</code>
    </p>

    <h2>Counter</h2>

    <p>
      Current count:
      <strong id="count">loading...</strong>
    </p>

    <button id="increment">Increment</button>
    <button id="decrement">Decrement</button>
    <button id="reset">Reset</button>
    <button id="refresh">Refresh</button>
    <button id="clear-token">Clear saved token</button>

    <h2>Last response</h2>
    <pre id="output"></pre>

    <script>
      const baseUrl = "/agents/counter-agent/default";

      const countEl = document.getElementById("count");
      const outputEl = document.getElementById("output");

      function getToken() {
        let token = localStorage.getItem("agentAuthToken");

        if (!token) {
          token = prompt("Enter Agent auth token:");

          if (token) {
            localStorage.setItem("agentAuthToken", token);
          }
        }

        return token;
      }

      async function callAgent(path) {
        const token = getToken();

        if (!token) {
          throw new Error("Missing Agent auth token");
        }

        const response = await fetch(baseUrl + path, {
          headers: {
            Authorization: "Bearer " + token,
          },
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error("Request failed: " + response.status + "\\n" + text);
        }

        return response.json();
      }

      function render(data) {
        if (typeof data.count === "number") {
          countEl.textContent = data.count;
        }

        outputEl.textContent = JSON.stringify(data, null, 2);
      }

      async function refresh() {
        render(await callAgent("/status"));
      }

      async function increment() {
        render(await callAgent("/increment"));
      }

      async function decrement() {
        render(await callAgent("/decrement"));
      }

      async function reset() {
        render(await callAgent("/reset"));
      }

      function handleError(error) {
        outputEl.textContent = error.stack || String(error);
      }

      document.getElementById("increment").addEventListener("click", function () {
        increment().catch(handleError);
      });

      document.getElementById("decrement").addEventListener("click", function () {
        decrement().catch(handleError);
      });

      document.getElementById("reset").addEventListener("click", function () {
        reset().catch(handleError);
      });

      document.getElementById("refresh").addEventListener("click", function () {
        refresh().catch(handleError);
      });

      document.getElementById("clear-token").addEventListener("click", function () {
        localStorage.removeItem("agentAuthToken");
        outputEl.textContent = "Saved token cleared.";
      });

      refresh().catch(handleError);
    </script>
  </body>
</html>
""")

print("==> Ensuring .env.local is ignored by git...")
gi = Path(".gitignore")
if ".env.local" not in (gi.read_text() if gi.is_file() else ""):
    with gi.open("a") as f:
        f.write(".env.local\n")

print("==> Uploading AGENT_AUTH_TOKEN as Cloudflare Worker secret...")
subprocess.run(
    ["pnpm", "exec", "wrangler", "secret", "put", "AGENT_AUTH_TOKEN"],
    input=token.encode(),
    check=True,
)

print("==> Regenerating types and checking TypeScript...")
subprocess.call(["pnpm", "run", "cf:types"])
subprocess.call(["pnpm", "run", "cf:typecheck"])

print("""
✅ Agent auth fixed.

Local test:
  lsof -ti :8787 | xargs -r kill -9
  pnpm run cf:dev

In another terminal:
  TOKEN="$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)"
  curl -i http://localhost:8787/agents/counter-agent/default/status
  curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8787/agents/counter-agent/default/status

Deploy:
  pnpm run cf:deploy""")
