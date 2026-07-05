#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

echo "==> Setting custom Agent path prefix: /api/agents"

echo "==> Backing up files..."
cp src/index.ts "src/index.ts.bak-agent-prefix-$(date +%Y%m%d-%H%M%S)"
cp public/index.html "public/index.html.bak-agent-prefix-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true

echo "==> Updating src/index.ts..."

python3 - <<'PY'
from pathlib import Path

lt = chr(60)
gt = chr(62)

content = f'''import {{ routeAgentRequest }} from "agents";

export {{ CounterAgent }} from "./agents/counter";

const AGENT_PATH_PREFIX = "/api/agents";
const DEFAULT_AGENT_PATH_PREFIX = "/agents";

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

export default {{
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise{lt}Response{gt} {{
    const url = new URL(request.url);

    const isCustomAgentRoute = url.pathname.startsWith(AGENT_PATH_PREFIX + "/");
    const isDefaultAgentRoute = url.pathname.startsWith(DEFAULT_AGENT_PATH_PREFIX + "/");

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

    if (isCustomAgentRoute && !isAuthorized(request, env)) {{
      return unauthorized();
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

echo "==> Updating public/index.html baseUrl to /api/agents..."

python3 - <<'PY'
from pathlib import Path

p = Path("public/index.html")
text = p.read_text()

text = text.replace(
    'const baseUrl = "/agents/counter-agent/default";',
    'const baseUrl = "/api/agents/counter-agent/default";'
)

text = text.replace(
    "/agents/counter-agent/default",
    "/api/agents/counter-agent/default"
)

p.write_text(text)
PY

echo "==> Regenerating types and checking TypeScript..."
pnpm run cf:types
pnpm run cf:typecheck

echo
echo "✅ Custom Agent prefix applied."
echo
echo "New public Agent path:"
echo "  /api/agents/counter-agent/default/status"
echo
echo "Old direct Agent path:"
echo "  /agents/counter-agent/default/status"
echo "  now returns 404 with a message."
echo
echo "Local test:"
echo "  lsof -ti :8787 | xargs -r kill -9"
echo "  pnpm run cf:dev"
echo
echo "In another terminal:"
echo "  TOKEN=\"\$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)\""
echo "  curl -i http://localhost:8787/api/agents/counter-agent/default/status"
echo "  curl -i -H \"Authorization: Bearer \$TOKEN\" http://localhost:8787/api/agents/counter-agent/default/status"
echo
echo "Deploy:"
echo "  pnpm run cf:deploy"
