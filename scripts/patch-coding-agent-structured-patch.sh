#!/usr/bin/env bash
set -euo pipefail

cd /home/tbaltzakis/cloudless.gr

echo "==> Adding /structured-patch endpoint to CodingAgent"

cp src/agents/coding.ts "src/agents/coding.ts.bak-structured-patch-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path

p = Path("src/agents/coding.ts")
text = p.read_text()

import_line = 'import { generateStructuredPatch } from "./structured-patch";\n'

if import_line not in text:
    text = text.replace(
        'import { Agent, callable } from "agents";\n',
        'import { Agent, callable } from "agents";\n' + import_line,
    )

marker = '''    if (url.pathname.endsWith("/patch")) {'''

structured_endpoint = '''    if (url.pathname.endsWith("/structured-patch")) {
      let prompt = url.searchParams.get("prompt") ?? "";
      let modelProfile = normalizeModelProfile(url.searchParams.get("model"), "patch");

      if (request.method === "POST") {
        try {
          const body = await request.json() as { prompt?: string; model?: string; modelProfile?: string };
          prompt = body.prompt ?? prompt;
          modelProfile = normalizeModelProfile(body.modelProfile ?? body.model ?? modelProfile, "patch");
        } catch {
          // Ignore malformed JSON and fall back to query string.
        }
      }

      if (!prompt.trim()) {
        return Response.json(
          {
            ok: false,
            error: "Missing prompt",
            example: "/api/agents/coding-agent/default/structured-patch",
          },
          {
            status: 400,
          }
        );
      }

      const route = getModelRoute(modelProfile, "patch");

      this.setRunning(prompt, "patch", route);

      try {
        const structuredPatch = await generateStructuredPatch(
          this.env,
          route.model,
          [
            buildSystemPrompt("patch"),
            "",
            "Return ONLY a structured patch object matching the schema.",
            "Use only the repository context below.",
            "",
            prompt,
          ].join("\\n")
        );

        const responseText = JSON.stringify(structuredPatch, null, 2);
        const gatewayLogId =
          typeof this.env.AI.aiGatewayLogId === "string" ? this.env.AI.aiGatewayLogId : "";

        const result = this.setDone(prompt, "patch", route, responseText, gatewayLogId);

        return Response.json({
          ok: true,
          structuredPatch,
          ...result,
        });
      } catch (error) {
        const result = this.setFailed(prompt, "patch", route, error);

        return Response.json(
          {
            ok: false,
            ...result,
          },
          {
            status: 500,
          }
        );
      }
    }

'''

if "/structured-patch" not in text:
    if marker not in text:
        raise SystemExit("Could not find /patch endpoint marker.")
    text = text.replace(marker, structured_endpoint + marker)

old_routes = '''        patch: "/api/agents/coding-agent/default/patch?prompt=Propose%20a%20safe%20patch&model=deep",
        result: "/api/agents/coding-agent/default/result",'''

new_routes = '''        patch: "/api/agents/coding-agent/default/patch?prompt=Propose%20a%20safe%20patch&model=deep",
        structuredPatch: "/api/agents/coding-agent/default/structured-patch",
        result: "/api/agents/coding-agent/default/result",'''

if old_routes in text and new_routes not in text:
    text = text.replace(old_routes, new_routes)

p.write_text(text)
PY

pnpm run cf:types
pnpm run cf:typecheck

python3 - <<'PY'
from pathlib import Path

p = Path("worker-configuration.d.ts")
if p.exists():
    p.write_text("\n".join(line.rstrip() for line in p.read_text().splitlines()) + "\n")
PY

echo "✅ /structured-patch endpoint added."
