#!/usr/bin/env python3
"""Add server-side Agent access — rewrites counter.ts with
getCount() and index.ts with /api/server/counter/* routes via
getAgentByName."""

import os
import shutil
import subprocess
import time
from pathlib import Path

PROJECT_DIR = Path("/home/tbaltzakis/cloudless.gr")
os.chdir(PROJECT_DIR)
print(f"==> Project: {PROJECT_DIR}")

ts = time.strftime("%Y%m%d-%H%M%S")
print("==> Backing up files...")
shutil.copy("src/index.ts",
            f"src/index.ts.bak-server-agent-access-{ts}")
shutil.copy("src/agents/counter.ts",
            f"src/agents/counter.ts.bak-server-agent-access-{ts}")

print("==> Updating CounterAgent with getCount() for "
      "server-side access...")
Path("src/agents/counter.ts").write_text('''import { Agent, callable } from "agents";

export type CounterState = {
  count: number;
};

export class CounterAgent extends Agent<Env, CounterState> {
  initialState: CounterState = {
    count: 0,
  };

  @callable()
  getCount() {
    return this.state?.count ?? 0;
  }

  @callable()
  increment() {
    const nextCount = (this.state?.count ?? 0) + 1;

    this.setState({
      count: nextCount,
    });

    return nextCount;
  }

  @callable()
  decrement() {
    const nextCount = (this.state?.count ?? 0) - 1;

    this.setState({
      count: nextCount,
    });

    return nextCount;
  }

  @callable()
  reset() {
    this.setState({
      count: 0,
    });

    return 0;
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/status")) {
      return Response.json({
        ok: true,
        count: this.getCount(),
      });
    }

    if (url.pathname.endsWith("/increment")) {
      return Response.json({
        ok: true,
        count: this.increment(),
      });
    }

    if (url.pathname.endsWith("/decrement")) {
      return Response.json({
        ok: true,
        count: this.decrement(),
      });
    }

    if (url.pathname.endsWith("/reset")) {
      return Response.json({
        ok: true,
        count: this.reset(),
      });
    }

    return Response.json({
      ok: true,
      agent: "CounterAgent",
      routes: {
        status: "/api/agents/counter-agent/default/status",
        increment: "/api/agents/counter-agent/default/increment",
        decrement: "/api/agents/counter-agent/default/decrement",
        reset: "/api/agents/counter-agent/default/reset",
      },
    });
  }
}
''')

print("==> Updating src/index.ts with server-side Agent "
      "access routes...")
Path("src/index.ts").write_text('''import { getAgentByName, routeAgentRequest } from "agents";
import { CounterAgent } from "./agents/counter";

export { CounterAgent };

const AGENT_PATH_PREFIX = "/api/agents";
const DEFAULT_AGENT_PATH_PREFIX = "/agents";
const SERVER_COUNTER_PREFIX = "/api/server/counter";

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

async function handleServerCounterRoute(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  // /api/server/counter/:instance/:action
  const instanceName = parts[3] || "default";
  const action = parts[4] || "status";

  const counter = await getAgentByName(env.CounterAgent, instanceName);

  if (action === "status") {
    return Response.json({
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.getCount(),
    });
  }

  if (action === "increment") {
    return Response.json({
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.increment(),
    });
  }

  if (action === "decrement") {
    return Response.json({
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.decrement(),
    });
  }

  if (action === "reset") {
    return Response.json({
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.reset(),
    });
  }

  return Response.json(
    {
      ok: false,
      error: "Unknown server counter action",
      instance: instanceName,
      action,
      routes: {
        status: "/api/server/counter/default/status",
        increment: "/api/server/counter/default/increment",
        decrement: "/api/server/counter/default/decrement",
        reset: "/api/server/counter/default/reset",
      },
    },
    {
      status: 404,
    }
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const isCustomAgentRoute = url.pathname.startsWith(AGENT_PATH_PREFIX + "/");
    const isDefaultAgentRoute = url.pathname.startsWith(DEFAULT_AGENT_PATH_PREFIX + "/");
    const isServerCounterRoute = url.pathname.startsWith(SERVER_COUNTER_PREFIX + "/");

    if ((isCustomAgentRoute || isServerCounterRoute) && !isAuthorized(request, env)) {
      return unauthorized();
    }

    if (isServerCounterRoute) {
      return handleServerCounterRoute(request, env);
    }

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

    const routedRequest = rewriteAgentPrefix(request);
    const agentResponse = await routeAgentRequest(routedRequest, env);

    if (agentResponse) {
      return agentResponse;
    }

    return env.ASSETS.fetch(request);
  },
};
''')

print("==> Regenerating types and checking TypeScript...")
subprocess.call(["pnpm", "run", "cf:types"])
subprocess.call(["pnpm", "run", "cf:typecheck"])

print("""
✅ Server-side Agent access added.

New server-side routes:
  /api/server/counter/default/status
  /api/server/counter/default/increment
  /api/server/counter/default/decrement
  /api/server/counter/default/reset

Local test:
  lsof -ti :8787 | xargs -r kill -9
  pnpm run cf:dev

In another terminal:
  TOKEN="$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)"
  curl -i http://localhost:8787/api/server/counter/default/status
  curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/server/counter/default/status
  curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/server/counter/default/increment

Deploy:
  pnpm run cf:deploy""")
