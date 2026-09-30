#!/usr/bin/env python3
"""Set the custom Agent path prefix /api/agents — rewrites
src/index.ts with the prefix router and updates the demo page
baseUrl."""

import os
import shutil
import subprocess
import time
from pathlib import Path

PROJECT_DIR = Path("/home/tbaltzakis/cloudless.gr")

os.chdir(PROJECT_DIR)

ts = time.strftime("%Y%m%d-%H%M%S")
print("==> Setting custom Agent path prefix: /api/agents")
print("==> Backing up files...")
shutil.copy("src/index.ts", f"src/index.ts.bak-agent-prefix-{ts}")
html = Path("public/index.html")
if html.is_file():
    shutil.copy(html, f"public/index.html.bak-agent-prefix-{ts}")

print("==> Updating src/index.ts...")
Path("src/index.ts").write_text("""import { routeAgentRequest } from "agents";

export { CounterAgent } from "./agents/counter";

const AGENT_PATH_PREFIX = "/api/agents";
const DEFAULT_AGENT_PATH_PREFIX = "/agents";

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

function rewriteAgentPrefix(request: Request) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith(AGENT_PATH_PREFIX + "/")) {
    return request;
  }

  url.pathname = DEFAULT_AGENT_PATH_PREFIX + url.pathname.slice(AGENT_PATH_PREFIX.length);

  return new Request(url.toString(), request);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const isCustomAgentRoute = url.pathname.startsWith(AGENT_PATH_PREFIX + "/");
    const isDefaultAgentRoute = url.pathname.startsWith(DEFAULT_AGENT_PATH_PREFIX + "/");

    if (isDefaultAgentRoute) {
      return Response.json(
        {
          ok: false,
          error: "Use custom Agent path prefix",
          pathPrefix: AGENT_PATH_PREFIX,
        },
        {
          status: 404,
        }
      );
    }

    if (isCustomAgentRoute && !isAuthorized(request, env)) {
      return unauthorized();
    }

    const routedRequest = rewriteAgentPrefix(request);
    const agentResponse = await routeAgentRequest(routedRequest, env);

    if (agentResponse) {
      return agentResponse;
    }

    return env.ASSETS.fetch(request);
  },
};
""")

print("==> Updating public/index.html baseUrl to /api/agents...")
if html.is_file():
    text = html.read_text()
    text = text.replace(
        'const baseUrl = "/agents/counter-agent/default";',
        'const baseUrl = "/api/agents/counter-agent/default";',
    )
    text = text.replace("/agents/counter-agent/default", "/api/agents/counter-agent/default")
    html.write_text(text)

print("==> Regenerating types and checking TypeScript...")
subprocess.call(["pnpm", "run", "cf:types"])
subprocess.call(["pnpm", "run", "cf:typecheck"])

print("""
✅ Custom Agent prefix applied.

New public Agent path:
  /api/agents/counter-agent/default/status

Old direct Agent path:
  /agents/counter-agent/default/status
  now returns 404 with a message.

Local test:
  lsof -ti :8787 | xargs -r kill -9
  pnpm run cf:dev

In another terminal:
  TOKEN="$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)"
  curl -i http://localhost:8787/api/agents/counter-agent/default/status
  curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/agents/counter-agent/default/status

Deploy:
  pnpm run cf:deploy""")
