#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

echo "==> Project: $PROJECT_DIR"

echo "==> Backing up files..."
cp src/index.ts "src/index.ts.bak-server-agent-access-$(date +%Y%m%d-%H%M%S)"
cp src/agents/counter.ts "src/agents/counter.ts.bak-server-agent-access-$(date +%Y%m%d-%H%M%S)"

echo "==> Updating CounterAgent with getCount() for server-side access..."

python3 - <<'PY'
from pathlib import Path

lt = chr(60)
gt = chr(62)

content = f'''import {{ Agent, callable }} from "agents";

export type CounterState = {{
  count: number;
}};

export class CounterAgent extends Agent{lt}Env, CounterState{gt} {{
  initialState: CounterState = {{
    count: 0,
  }};

  @callable()
  getCount() {{
    return this.state?.count ?? 0;
  }}

  @callable()
  increment() {{
    const nextCount = (this.state?.count ?? 0) + 1;

    this.setState({{
      count: nextCount,
    }});

    return nextCount;
  }}

  @callable()
  decrement() {{
    const nextCount = (this.state?.count ?? 0) - 1;

    this.setState({{
      count: nextCount,
    }});

    return nextCount;
  }}

  @callable()
  reset() {{
    this.setState({{
      count: 0,
    }});

    return 0;
  }}

  async onRequest(request: Request): Promise{lt}Response{gt} {{
    const url = new URL(request.url);

    if (url.pathname.endsWith("/status")) {{
      return Response.json({{
        ok: true,
        count: this.getCount(),
      }});
    }}

    if (url.pathname.endsWith("/increment")) {{
      return Response.json({{
        ok: true,
        count: this.increment(),
      }});
    }}

    if (url.pathname.endsWith("/decrement")) {{
      return Response.json({{
        ok: true,
        count: this.decrement(),
      }});
    }}

    if (url.pathname.endsWith("/reset")) {{
      return Response.json({{
        ok: true,
        count: this.reset(),
      }});
    }}

    return Response.json({{
      ok: true,
      agent: "CounterAgent",
      routes: {{
        status: "/api/agents/counter-agent/default/status",
        increment: "/api/agents/counter-agent/default/increment",
        decrement: "/api/agents/counter-agent/default/decrement",
        reset: "/api/agents/counter-agent/default/reset",
      }},
    }});
  }}
}}
'''

Path("src/agents/counter.ts").write_text(content)
PY

echo "==> Updating src/index.ts with server-side Agent access routes..."

python3 - <<'PY'
from pathlib import Path

lt = chr(60)
gt = chr(62)

content = f'''import {{ getAgentByName, routeAgentRequest }} from "agents";
import {{ CounterAgent }} from "./agents/counter";

export {{ CounterAgent }};

const AGENT_PATH_PREFIX = "/api/agents";
const DEFAULT_AGENT_PATH_PREFIX = "/agents";
const SERVER_COUNTER_PREFIX = "/api/server/counter";

function unauthorized() {{
  return Response.json(
    {{
      ok: false,
      error: "Unauthorized",
    }},
    {{
      status: 401,
      headers: {{
        "www-authenticate": 'Bearer realm="CounterAgent"',
      }},
    }}
  );
}}

function isAuthorized(request: Request, env: Env) {{
  const expectedToken = env.AGENT_AUTH_TOKEN;

  if (!expectedToken) {{
    return false;
  }}

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {{
    return false;
  }}

  const token = authorization.slice("Bearer ".length).trim();

  return token === expectedToken;
}}

function rewriteAgentPrefix(request: Request) {{
  const url = new URL(request.url);

  if (!url.pathname.startsWith(AGENT_PATH_PREFIX + "/")) {{
    return request;
  }}

  url.pathname = DEFAULT_AGENT_PATH_PREFIX + url.pathname.slice(AGENT_PATH_PREFIX.length);

  return new Request(url.toString(), request);
}}

async function handleServerCounterRoute(request: Request, env: Env): Promise{lt}Response{gt} {{
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  // /api/server/counter/:instance/:action
  const instanceName = parts[3] || "default";
  const action = parts[4] || "status";

  const counter = await getAgentByName(env.CounterAgent, instanceName);

  if (action === "status") {{
    return Response.json({{
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.getCount(),
    }});
  }}

  if (action === "increment") {{
    return Response.json({{
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.increment(),
    }});
  }}

  if (action === "decrement") {{
    return Response.json({{
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.decrement(),
    }});
  }}

  if (action === "reset") {{
    return Response.json({{
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.reset(),
    }});
  }}

  return Response.json(
    {{
      ok: false,
      error: "Unknown server counter action",
      instance: instanceName,
      action,
      routes: {{
        status: "/api/server/counter/default/status",
        increment: "/api/server/counter/default/increment",
        decrement: "/api/server/counter/default/decrement",
        reset: "/api/server/counter/default/reset",
      }},
    }},
    {{
      status: 404,
    }}
  );
}}

export default {{
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise{lt}Response{gt} {{
    const url = new URL(request.url);

    const isCustomAgentRoute = url.pathname.startsWith(AGENT_PATH_PREFIX + "/");
    const isDefaultAgentRoute = url.pathname.startsWith(DEFAULT_AGENT_PATH_PREFIX + "/");
    const isServerCounterRoute = url.pathname.startsWith(SERVER_COUNTER_PREFIX + "/");

    if ((isCustomAgentRoute || isServerCounterRoute) && !isAuthorized(request, env)) {{
      return unauthorized();
    }}

    if (isServerCounterRoute) {{
      return handleServerCounterRoute(request, env);
    }}

    if (isDefaultAgentRoute) {{
      return Response.json(
        {{
          ok: false,
          error: "Use custom Agent path prefix",
          pathPrefix: AGENT_PATH_PREFIX,
        }},
        {{
          status: 404,
        }}
      );
    }}

    const routedRequest = rewriteAgentPrefix(request);
    const agentResponse = await routeAgentRequest(routedRequest, env);

    if (agentResponse) {{
      return agentResponse;
    }}

    return env.ASSETS.fetch(request);
  }},
}};
'''

Path("src/index.ts").write_text(content)
PY

echo "==> Regenerating types and checking TypeScript..."
pnpm run cf:types
pnpm run cf:typecheck

echo
echo "✅ Server-side Agent access added."
echo
echo "New server-side routes:"
echo "  /api/server/counter/default/status"
echo "  /api/server/counter/default/increment"
echo "  /api/server/counter/default/decrement"
echo "  /api/server/counter/default/reset"
echo
echo "Local test:"
echo "  lsof -ti :8787 | xargs -r kill -9"
echo "  pnpm run cf:dev"
echo
echo "In another terminal:"
echo "  TOKEN=\"\$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)\""
echo "  curl -i http://localhost:8787/api/server/counter/default/status"
echo "  curl -i -H \"Authorization: Bearer \$TOKEN\" http://localhost:8787/api/server/counter/default/status"
echo "  curl -i -H \"Authorization: Bearer \$TOKEN\" http://localhost:8787/api/server/counter/default/increment"
echo
echo "Deploy:"
echo "  pnpm run cf:deploy"
