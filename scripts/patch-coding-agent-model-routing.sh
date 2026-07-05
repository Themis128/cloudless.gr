#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

echo "==> Patching CodingAgent with AI Gateway model routing"

cp src/agents/coding.ts "src/agents/coding.ts.bak-model-routing-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path

lt = chr(60)
gt = chr(62)

content = f'''import {{ Agent, callable }} from "agents";

export type CodingStatus = "idle" | "running" | "done" | "failed";
export type CodingMode = "review" | "patch";
export type CodingModelProfile = "fast" | "review" | "deep";

export type CodingState = {{
  lastPrompt: string;
  lastResponse: string;
  count: number;
  updatedAt: string;
  status: CodingStatus;
  mode: CodingMode;
  modelProfile: CodingModelProfile;
  model: string;
  gatewayId: string;
  gatewayLogId: string;
  error: string;
}};

type ModelRoute = {{
  profile: CodingModelProfile;
  model: string;
  gatewayId: string;
  skipCache: boolean;
  cacheTtl?: number;
}};

function cleanModelText(text: string): string {{
  const thinkEnd = text.lastIndexOf("</think>");

  if (thinkEnd >= 0) {{
    text = text.slice(thinkEnd + "</think>".length);
  }}

  return text.trim();
}}

function extractText(result: unknown): string {{
  let text: string;

  if (typeof result === "string") {{
    text = result;
  }} else if (result && typeof result === "object") {{
    const value = result as Record<string, unknown>;

    if (typeof value.response === "string") {{
      text = value.response;
    }} else if (typeof value.text === "string") {{
      text = value.text;
    }} else if (typeof value.result === "string") {{
      text = value.result;
    }} else {{
      text = JSON.stringify(result, null, 2);
    }}
  }} else {{
    text = JSON.stringify(result, null, 2);
  }}

  return cleanModelText(text);
}}

function nowIso() {{
  return new Date().toISOString();
}}

function normalizeMode(value: string | null | undefined): CodingMode {{
  return value === "patch" ? "patch" : "review";
}}

function normalizeModelProfile(value: string | null | undefined, mode: CodingMode): CodingModelProfile {{
  if (value === "fast" || value === "review" || value === "deep") {{
    return value;
  }}

  return mode === "patch" ? "deep" : "review";
}}

function getModelRoute(profile: CodingModelProfile, mode: CodingMode): ModelRoute {{
  const gatewayId = "default";

  if (profile === "fast") {{
    return {{
      profile,
      model: "@cf/meta/llama-3.1-8b-instruct",
      gatewayId,
      skipCache: false,
      cacheTtl: 3600,
    }};
  }}

  if (profile === "deep") {{
    return {{
      profile,
      model: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
      gatewayId,
      skipCache: mode === "patch",
    }};
  }}

  return {{
    profile,
    model: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    gatewayId,
    skipCache: mode === "patch",
  }};
}}

function buildSystemPrompt(mode: CodingMode): string {{
  const shared = [
    "You are CodingAgent for the cloudless.gr project.",
    "The project is a TypeScript Cloudflare Workers + Cloudflare Agents SDK application.",
    "The Worker uses Durable Object Agents, routeAgentRequest(), Workers AI, Static Assets, Bearer-token auth, and AI Gateway model routing.",
    "Use ONLY the repository context provided in the user task.",
    "Do not assume Express.js, Node HTTP servers, Vercel routing, wrangler.toml, or files that are not shown.",
    "If a claim cannot be verified from the provided context, say so explicitly.",
    "If something is already implemented in the provided code, say it is implemented.",
    "Do not claim that you executed commands, edited files, deployed code, inspected files outside the prompt, or accessed a shell.",
    "You are in planning/suggestion mode only.",
    "Do not include <think>, hidden reasoning, chain-of-thought, or internal analysis.",
    "Prefer TypeScript, Cloudflare Workers, Durable Objects, Workers AI, AI Gateway, and secure defaults.",
  ];

  if (mode === "patch") {{
    return [
      ...shared,
      "",
      "Return a patch proposal only. Use this exact structure:",
      "1. Summary",
      "2. Evidence from repository context",
      "3. Proposed changes",
      "4. Unified diff patch",
      "5. Commands to run",
      "6. Verification plan",
      "7. Risks and rollback",
      "",
      "Rules for patch proposals:",
      "- Only propose edits to files shown in the repository context.",
      "- If you cannot produce a safe patch from the evidence, say so and explain what context is missing.",
      "- Use unified diff format in section 4.",
      "- Do not invent file paths.",
      "- Do not create new files unless the user explicitly requested new files.",
      "- Allowed file paths are only those present in the repository context under lines that start with ## FILE:.",
      "- Every path in the unified diff must match an existing ## FILE path from the repository context.",
      "- If no safe patch can be made using only those files, output NO_SAFE_PATCH and explain why.",
      "- Do not include secrets.",
      "- Do not invent environment variable names, import paths, framework assumptions, or public files not shown in context.",
    ].join("\\n");
  }}

  return [
    ...shared,
    "",
    "Return a concise repository-aware review. Use this exact structure:",
    "1. Summary",
    "2. Evidence from repository context",
    "3. Findings",
    "4. Recommended changes",
    "5. Commands to run",
    "6. Risks / cautions",
    "",
    "Rules for reviews:",
    "- Reference exact files, constants, functions, routes, or bindings from the repository context.",
    "- Do not produce generic warnings that contradict the provided code.",
    "- Prefer concrete next actions over broad advice.",
  ].join("\\n");
}}

export class CodingAgent extends Agent{lt}Env, CodingState{gt} {{
  initialState: CodingState = {{
    lastPrompt: "",
    lastResponse: "",
    count: 0,
    updatedAt: "",
    status: "idle",
    mode: "review",
    modelProfile: "review",
    model: "",
    gatewayId: "default",
    gatewayLogId: "",
    error: "",
  }};

  @callable()
  getState() {{
    return {{
      lastPrompt: this.state?.lastPrompt ?? "",
      lastResponse: this.state?.lastResponse ?? "",
      count: this.state?.count ?? 0,
      updatedAt: this.state?.updatedAt ?? "",
      status: this.state?.status ?? "idle",
      mode: this.state?.mode ?? "review",
      modelProfile: this.state?.modelProfile ?? "review",
      model: this.state?.model ?? "",
      gatewayId: this.state?.gatewayId ?? "default",
      gatewayLogId: this.state?.gatewayLogId ?? "",
      error: this.state?.error ?? "",
    }};
  }}

  @callable()
  getResult() {{
    return this.getState();
  }}

  @callable()
  reset() {{
    const nextState: CodingState = {{
      lastPrompt: "",
      lastResponse: "",
      count: 0,
      updatedAt: nowIso(),
      status: "idle",
      mode: "review",
      modelProfile: "review",
      model: "",
      gatewayId: "default",
      gatewayLogId: "",
      error: "",
    }};

    this.setState(nextState);

    return nextState;
  }}

  private setRunning(prompt: string, mode: CodingMode, route: ModelRoute) {{
    const nextState: CodingState = {{
      lastPrompt: prompt,
      lastResponse: this.state?.lastResponse ?? "",
      count: this.state?.count ?? 0,
      updatedAt: nowIso(),
      status: "running",
      mode,
      modelProfile: route.profile,
      model: route.model,
      gatewayId: route.gatewayId,
      gatewayLogId: "",
      error: "",
    }};

    this.setState(nextState);

    return nextState;
  }}

  private setDone(prompt: string, mode: CodingMode, route: ModelRoute, responseText: string, gatewayLogId: string) {{
    const nextState: CodingState = {{
      lastPrompt: prompt,
      lastResponse: responseText,
      count: (this.state?.count ?? 0) + 1,
      updatedAt: nowIso(),
      status: "done",
      mode,
      modelProfile: route.profile,
      model: route.model,
      gatewayId: route.gatewayId,
      gatewayLogId,
      error: "",
    }};

    this.setState(nextState);

    return nextState;
  }}

  private setFailed(prompt: string, mode: CodingMode, route: ModelRoute, error: unknown) {{
    const message = error instanceof Error ? error.message : String(error);

    const nextState: CodingState = {{
      lastPrompt: prompt,
      lastResponse: this.state?.lastResponse ?? "",
      count: this.state?.count ?? 0,
      updatedAt: nowIso(),
      status: "failed",
      mode,
      modelProfile: route.profile,
      model: route.model,
      gatewayId: route.gatewayId,
      gatewayLogId: "",
      error: message,
    }};

    this.setState(nextState);

    return nextState;
  }}

  async runCodingTask(
    prompt: string,
    mode: CodingMode = "review",
    modelProfile: CodingModelProfile = "review"
  ) {{
    const route = getModelRoute(modelProfile, mode);

    this.setRunning(prompt, mode, route);

    try {{
      const systemPrompt = buildSystemPrompt(mode);

      const result = await this.env.AI.run(
        route.model,
        {{
          prompt: systemPrompt + "\\n\\nUser task and repository context:\\n" + prompt,
        }},
        {{
          gateway: {{
            id: route.gatewayId,
            skipCache: route.skipCache,
            cacheTtl: route.cacheTtl,
            collectLog: true,
            metadata: {{
              agent: "CodingAgent",
              mode,
              modelProfile: route.profile,
              model: route.model,
            }},
          }},
        }}
      );

      const responseText = extractText(result);
      const gatewayLogId =
        typeof this.env.AI.aiGatewayLogId === "string" ? this.env.AI.aiGatewayLogId : "";

      return this.setDone(prompt, mode, route, responseText, gatewayLogId);
    }} catch (error) {{
      return this.setFailed(prompt, mode, route, error);
    }}
  }}

  async onRequest(request: Request): Promise{lt}Response{gt} {{
    const url = new URL(request.url);

    if (url.pathname.endsWith("/status")) {{
      const state = this.getState();

      return Response.json({{
        ok: true,
        lastPrompt: state.lastPrompt,
        count: state.count,
        updatedAt: state.updatedAt,
        status: state.status,
        mode: state.mode,
        modelProfile: state.modelProfile,
        model: state.model,
        gatewayId: state.gatewayId,
        gatewayLogId: state.gatewayLogId,
        error: state.error,
      }});
    }}

    if (url.pathname.endsWith("/result")) {{
      return Response.json({{
        ok: true,
        ...this.getResult(),
      }});
    }}

    if (url.pathname.endsWith("/reset")) {{
      return Response.json({{
        ok: true,
        ...this.reset(),
      }});
    }}

    if (url.pathname.endsWith("/patch")) {{
      let prompt = url.searchParams.get("prompt") ?? "";
      let modelProfile = normalizeModelProfile(url.searchParams.get("model"), "patch");

      if (request.method === "POST") {{
        try {{
          const body = await request.json() as {{ prompt?: string; model?: string; modelProfile?: string }};
          prompt = body.prompt ?? prompt;
          modelProfile = normalizeModelProfile(body.modelProfile ?? body.model ?? modelProfile, "patch");
        }} catch {{
          // Ignore malformed JSON and fall back to query string.
        }}
      }}

      if (!prompt.trim()) {{
        return Response.json(
          {{
            ok: false,
            error: "Missing prompt",
            example: "/api/agents/coding-agent/default/patch?prompt=Propose%20a%20safe%20patch",
          }},
          {{
            status: 400,
          }}
        );
      }}

      const result = await this.runCodingTask(prompt, "patch", modelProfile);

      return Response.json({{
        ok: result.status !== "failed",
        ...result,
      }});
    }}

    if (url.pathname.endsWith("/task")) {{
      let prompt = url.searchParams.get("prompt") ?? "";
      let mode = normalizeMode(url.searchParams.get("mode"));
      let modelProfile = normalizeModelProfile(url.searchParams.get("model"), mode);

      if (request.method === "POST") {{
        try {{
          const body = await request.json() as {{ prompt?: string; mode?: string; model?: string; modelProfile?: string }};
          prompt = body.prompt ?? prompt;
          mode = normalizeMode(body.mode ?? mode);
          modelProfile = normalizeModelProfile(body.modelProfile ?? body.model ?? modelProfile, mode);
        }} catch {{
          // Ignore malformed JSON and fall back to query string.
        }}
      }}

      if (!prompt.trim()) {{
        return Response.json(
          {{
            ok: false,
            error: "Missing prompt",
            example: "/api/agents/coding-agent/default/task?prompt=Review%20my%20Worker%20routing",
          }},
          {{
            status: 400,
          }}
        );
      }}

      const result = await this.runCodingTask(prompt, mode, modelProfile);

      return Response.json({{
        ok: result.status !== "failed",
        ...result,
      }});
    }}

    return Response.json({{
      ok: true,
      agent: "CodingAgent",
      modelRouting: {{
        gatewayId: "default",
        profiles: {{
          fast: "@cf/meta/llama-3.1-8b-instruct",
          review: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
          deep: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        }},
      }},
      routes: {{
        status: "/api/agents/coding-agent/default/status",
        task: "/api/agents/coding-agent/default/task?prompt=Review%20my%20Worker%20routing&model=review",
        patch: "/api/agents/coding-agent/default/patch?prompt=Propose%20a%20safe%20patch&model=deep",
        result: "/api/agents/coding-agent/default/result",
        reset: "/api/agents/coding-agent/default/reset",
      }},
    }});
  }}
}}
'''

Path("src/agents/coding.ts").write_text(content)
PY

echo "==> Running checks..."
pnpm run cf:types
pnpm run cf:typecheck

echo
echo "✅ CodingAgent model routing patch applied."
echo
echo "Local tests:"
echo "  TOKEN=\"\$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)\""
echo "  curl -i -H \"Authorization: Bearer \$TOKEN\" \"http://localhost:8787/api/agents/coding-agent/default/task?prompt=Say%20hello%20using%20fast%20model&model=fast\""
echo "  curl -i -H \"Authorization: Bearer \$TOKEN\" \"http://localhost:8787/api/agents/coding-agent/default/status\""
echo
echo "Deploy:"
echo "  pnpm run cf:deploy"
