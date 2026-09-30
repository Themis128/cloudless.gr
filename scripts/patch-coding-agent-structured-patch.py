#!/usr/bin/env python3
"""Add the /structured-patch endpoint to CodingAgent — inserts the
endpoint block + import + routes entry into src/agents/coding.ts,
then regenerates types and typechecks."""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

os.chdir("/home/tbaltzakis/cloudless.gr")

print("==> Adding /structured-patch endpoint to CodingAgent")

p = Path("src/agents/coding.ts")
shutil.copy(
    p, f"{p}.bak-structured-patch-"
       f"{time.strftime('%Y%m%d-%H%M%S')}")
text = p.read_text()

import_line = ('import { generateStructuredPatch } from '
               '"./structured-patch";\n')
if import_line not in text:
    text = text.replace(
        'import { Agent, callable } from "agents";\n',
        'import { Agent, callable } from "agents";\n'
        + import_line)

marker = '    if (url.pathname.endsWith("/patch")) {'
endpoint = '''    if (url.pathname.endsWith("/structured-patch")) {
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
        sys.exit("Could not find /patch endpoint marker.")
    text = text.replace(marker, endpoint + marker)

old_routes = ('        patch: "/api/agents/coding-agent/default/'
              'patch?prompt=Propose%20a%20safe%20patch&'
              'model=deep",\n'
              '        result: "/api/agents/coding-agent/'
              'default/result",')
new_routes = ('        patch: "/api/agents/coding-agent/default/'
              'patch?prompt=Propose%20a%20safe%20patch&'
              'model=deep",\n'
              '        structuredPatch: "/api/agents/'
              'coding-agent/default/structured-patch",\n'
              '        result: "/api/agents/coding-agent/'
              'default/result",')
if old_routes in text and new_routes not in text:
    text = text.replace(old_routes, new_routes)

p.write_text(text)

subprocess.call(["pnpm", "run", "cf:types"])
subprocess.call(["pnpm", "run", "cf:typecheck"])

wt = Path("worker-configuration.d.ts")
if wt.exists():
    wt.write_text("\n".join(
        l.rstrip() for l in
        wt.read_text().splitlines()) + "\n")

print("✅ /structured-patch endpoint added.")
