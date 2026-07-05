#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"

cd "$PROJECT_DIR"

echo "==> Project: $PROJECT_DIR"

echo "==> Backing up files..."
cp src/index.ts "src/index.ts.bak-agent-auth-$(date +%Y%m%d-%H%M%S)"
cp public/index.html "public/index.html.bak-agent-auth-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
cp .env.local ".env.local.bak-agent-auth-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true

echo "==> Ensuring AGENT_AUTH_TOKEN exists once in .env.local..."

if [ -f .env.local ] && grep -q '^AGENT_AUTH_TOKEN=' .env.local; then
  TOKEN="$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)"
else
  TOKEN="$(openssl rand -base64 48 | tr -d '\n')"
fi

python3 - <<PY
from pathlib import Path

token = """$TOKEN"""

p = Path(".env.local")
if p.exists():
    lines = p.read_text().splitlines()
else:
    lines = []

lines = [
    line for line in lines
    if not line.startswith("AGENT_AUTH_TOKEN=")
]

lines.append("")
lines.append(f"AGENT_AUTH_TOKEN={token}")

p.write_text("\\n".join(lines) + "\\n")
PY

echo "==> Writing authenticated Agent router to src/index.ts..."

python3 - <<'PY'
from pathlib import Path

lt = chr(60)
gt = chr(62)

content = f'''import {{ routeAgentRequest }} from "agents";

export {{ CounterAgent }} from "./agents/counter";

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

export default {{
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise{lt}Response{gt} {{
    const url = new URL(request.url);
    const isAgentRoute = url.pathname.startsWith("/agents/");

    if (isAgentRoute && !isAuthorized(request, env)) {{
      return unauthorized();
    }}

    const agentResponse = await routeAgentRequest(request, env);

    if (agentResponse) {{
      return agentResponse;
    }}

    return env.ASSETS.fetch(request);
  }},
}};
'''

Path("src/index.ts").write_text(content)
PY

echo "==> Writing token-aware vanilla JS frontend to public/index.html..."

mkdir -p public

python3 - <<'PY'
from pathlib import Path

lt = chr(60)
gt = chr(62)

html = f'''{lt}!doctype html{gt}
{lt}html{gt}
  {lt}head{gt}
    {lt}meta charset="utf-8" /{gt}
    {lt}title{gt}Cloudless Agent Worker{lt}/title{gt}
    {lt}style{gt}
      body {{
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        max-width: 720px;
        margin: 48px auto;
        padding: 0 24px;
      }}

      button {{
        margin-right: 8px;
        padding: 8px 12px;
        cursor: pointer;
      }}

      code {{
        background: #f4f4f4;
        padding: 2px 6px;
        border-radius: 4px;
      }}

      pre {{
        background: #111;
        color: #0f0;
        padding: 16px;
        border-radius: 8px;
        overflow: auto;
      }}
    {lt}/style{gt}
  {lt}/head{gt}
  {lt}body{gt}
    {lt}h1{gt}Cloudless Agent Worker{lt}/h1{gt}

    {lt}p{gt}
      CounterAgent instance:
      {lt}code{gt}/agents/counter-agent/default{lt}/code{gt}
    {lt}/p{gt}

    {lt}h2{gt}Counter{lt}/h2{gt}

    {lt}p{gt}
      Current count:
      {lt}strong id="count"{gt}loading...{lt}/strong{gt}
    {lt}/p{gt}

    {lt}button id="increment"{gt}Increment{lt}/button{gt}
    {lt}button id="decrement"{gt}Decrement{lt}/button{gt}
    {lt}button id="reset"{gt}Reset{lt}/button{gt}
    {lt}button id="refresh"{gt}Refresh{lt}/button{gt}
    {lt}button id="clear-token"{gt}Clear saved token{lt}/button{gt}

    {lt}h2{gt}Last response{lt}/h2{gt}
    {lt}pre id="output"{gt}{lt}/pre{gt}

    {lt}script{gt}
      const baseUrl = "/agents/counter-agent/default";

      const countEl = document.getElementById("count");
      const outputEl = document.getElementById("output");

      function getToken() {{
        let token = localStorage.getItem("agentAuthToken");

        if (!token) {{
          token = prompt("Enter Agent auth token:");

          if (token) {{
            localStorage.setItem("agentAuthToken", token);
          }}
        }}

        return token;
      }}

      async function callAgent(path) {{
        const token = getToken();

        if (!token) {{
          throw new Error("Missing Agent auth token");
        }}

        const response = await fetch(baseUrl + path, {{
          headers: {{
            Authorization: "Bearer " + token,
          }},
        }});

        if (!response.ok) {{
          const text = await response.text();
          throw new Error("Request failed: " + response.status + "\\n" + text);
        }}

        return response.json();
      }}

      function render(data) {{
        if (typeof data.count === "number") {{
          countEl.textContent = data.count;
        }}

        outputEl.textContent = JSON.stringify(data, null, 2);
      }}

      async function refresh() {{
        render(await callAgent("/status"));
      }}

      async function increment() {{
        render(await callAgent("/increment"));
      }}

      async function decrement() {{
        render(await callAgent("/decrement"));
      }}

      async function reset() {{
        render(await callAgent("/reset"));
      }}

      function handleError(error) {{
        outputEl.textContent = error.stack || String(error);
      }}

      document.getElementById("increment").addEventListener("click", function () {{
        increment().catch(handleError);
      }});

      document.getElementById("decrement").addEventListener("click", function () {{
        decrement().catch(handleError);
      }});

      document.getElementById("reset").addEventListener("click", function () {{
        reset().catch(handleError);
      }});

      document.getElementById("refresh").addEventListener("click", function () {{
        refresh().catch(handleError);
      }});

      document.getElementById("clear-token").addEventListener("click", function () {{
        localStorage.removeItem("agentAuthToken");
        outputEl.textContent = "Saved token cleared.";
      }});

      refresh().catch(handleError);
    {lt}/script{gt}
  {lt}/body{gt}
{lt}/html{gt}
'''

Path("public/index.html").write_text(html)
PY

echo "==> Ensuring .env.local is ignored by git..."
grep -n '^\.env.local$' .gitignore >/dev/null 2>&1 || echo '.env.local' >> .gitignore

echo "==> Uploading AGENT_AUTH_TOKEN as Cloudflare Worker secret..."
printf "%s" "$TOKEN" | pnpm exec wrangler secret put AGENT_AUTH_TOKEN

echo "==> Regenerating types and checking TypeScript..."
pnpm run cf:types
pnpm run cf:typecheck

echo
echo "✅ Agent auth fixed."
echo
echo "Local test:"
echo "  lsof -ti :8787 | xargs -r kill -9"
echo "  pnpm run cf:dev"
echo
echo "In another terminal:"
echo "  TOKEN=\"\$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)\""
echo "  curl -i http://localhost:8787/agents/counter-agent/default/status"
echo "  curl -i -H \"Authorization: Bearer \$TOKEN\" http://localhost:8787/agents/counter-agent/default/status"
echo
echo "Deploy:"
echo "  pnpm run cf:deploy"
