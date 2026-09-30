#!/usr/bin/env python3
"""Patch CodingAgent with task lifecycle status/result tracking —
rewrites src/agents/coding.ts with the CodingStatus state machine
(running/done/failed + /result endpoint)."""

import os
import shutil
import subprocess
import time
from pathlib import Path

PROJECT_DIR = Path("/home/tbaltzakis/cloudless.gr")
os.chdir(PROJECT_DIR)

print("==> Patching CodingAgent with task lifecycle "
      "status/result tracking")

p = Path("src/agents/coding.ts")
shutil.copy(p, f"{p}.bak-long-running-"
               f"{time.strftime('%Y%m%d-%H%M%S')}")

p.write_text('''import { Agent, callable } from "agents";

export type CodingStatus = "idle" | "running" | "done" | "failed";

export type CodingState = {
  lastPrompt: string;
  lastResponse: string;
  count: number;
  updatedAt: string;
  status: CodingStatus;
  error: string;
};

function cleanModelText(text: string): string {
  const thinkEnd = text.lastIndexOf("</think>");

  if (thinkEnd >= 0) {
    text = text.slice(thinkEnd + "</think>".length);
  }

  return text.trim();
}

function extractText(result: unknown): string {
  let text: string;

  if (typeof result === "string") {
    text = result;
  } else if (result && typeof result === "object") {
    const value = result as Record<string, unknown>;

    if (typeof value.response === "string") {
      text = value.response;
    } else if (typeof value.text === "string") {
      text = value.text;
    } else if (typeof value.result === "string") {
      text = value.result;
    } else {
      text = JSON.stringify(result, null, 2);
    }
  } else {
    text = JSON.stringify(result, null, 2);
  }

  return cleanModelText(text);
}

function nowIso() {
  return new Date().toISOString();
}

export class CodingAgent extends Agent<Env, CodingState> {
  initialState: CodingState = {
    lastPrompt: "",
    lastResponse: "",
    count: 0,
    updatedAt: "",
    status: "idle",
    error: "",
  };

  @callable()
  getState() {
    return {
      lastPrompt: this.state?.lastPrompt ?? "",
      lastResponse: this.state?.lastResponse ?? "",
      count: this.state?.count ?? 0,
      updatedAt: this.state?.updatedAt ?? "",
      status: this.state?.status ?? "idle",
      error: this.state?.error ?? "",
    };
  }

  @callable()
  getResult() {
    return {
      lastPrompt: this.state?.lastPrompt ?? "",
      lastResponse: this.state?.lastResponse ?? "",
      count: this.state?.count ?? 0,
      updatedAt: this.state?.updatedAt ?? "",
      status: this.state?.status ?? "idle",
      error: this.state?.error ?? "",
    };
  }

  @callable()
  reset() {
    const nextState: CodingState = {
      lastPrompt: "",
      lastResponse: "",
      count: 0,
      updatedAt: nowIso(),
      status: "idle",
      error: "",
    };

    this.setState(nextState);

    return nextState;
  }

  private setRunning(prompt: string) {
    const nextState: CodingState = {
      lastPrompt: prompt,
      lastResponse: this.state?.lastResponse ?? "",
      count: this.state?.count ?? 0,
      updatedAt: nowIso(),
      status: "running",
      error: "",
    };

    this.setState(nextState);

    return nextState;
  }

  private setDone(prompt: string, responseText: string) {
    const nextState: CodingState = {
      lastPrompt: prompt,
      lastResponse: responseText,
      count: (this.state?.count ?? 0) + 1,
      updatedAt: nowIso(),
      status: "done",
      error: "",
    };

    this.setState(nextState);

    return nextState;
  }

  private setFailed(prompt: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    const nextState: CodingState = {
      lastPrompt: prompt,
      lastResponse: this.state?.lastResponse ?? "",
      count: this.state?.count ?? 0,
      updatedAt: nowIso(),
      status: "failed",
      error: message,
    };

    this.setState(nextState);

    return nextState;
  }

  async runCodingTask(prompt: string) {
    this.setRunning(prompt);

    try {
      const systemPrompt = [
        "You are CodingAgent for the cloudless.gr project.",
        "The project is a TypeScript Cloudflare Workers + Cloudflare Agents SDK application.",
        "The Worker uses Durable Object Agents, routeAgentRequest(), Workers AI, Static Assets, and Bearer-token auth.",
        "Do not assume Express.js, Node HTTP servers, Vercel routing, or traditional backend servers unless explicitly provided.",
        "Do not claim that you executed commands, edited files, deployed code, or inspected files.",
        "You are in planning/suggestion mode only.",
        "Do not include <think>, hidden reasoning, chain-of-thought, or internal analysis.",
        "Return concise structured output with these sections:",
        "1. Summary",
        "2. Relevant Cloudflare Workers/Agents context",
        "3. Findings",
        "4. Recommended changes",
        "5. Commands to run",
        "6. Risks / cautions",
        "Prefer TypeScript, Cloudflare Workers, Durable Objects, Workers AI, and secure defaults."
      ].join("\\n");

      const result = await this.env.AI.run(
        "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        {
          prompt: systemPrompt + "\\n\\nUser task:\\n" + prompt,
        }
      );

      const responseText = extractText(result);

      return this.setDone(prompt, responseText);
    } catch (error) {
      return this.setFailed(prompt, error);
    }
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/status")) {
      const state = this.getState();

      return Response.json({
        ok: true,
        lastPrompt: state.lastPrompt,
        count: state.count,
        updatedAt: state.updatedAt,
        status: state.status,
        error: state.error,
      });
    }

    if (url.pathname.endsWith("/result")) {
      return Response.json({
        ok: true,
        ...this.getResult(),
      });
    }

    if (url.pathname.endsWith("/reset")) {
      return Response.json({
        ok: true,
        ...this.reset(),
      });
    }

    if (url.pathname.endsWith("/task")) {
      let prompt = url.searchParams.get("prompt") ?? "";

      if (request.method === "POST") {
        try {
          const body = await request.json() as { prompt?: string };
          prompt = body.prompt ?? prompt;
        } catch {
          // Ignore malformed JSON and fall back to query string.
        }
      }

      if (!prompt.trim()) {
        return Response.json(
          {
            ok: false,
            error: "Missing prompt",
            example: "/api/agents/coding-agent/default/task?prompt=Review%20my%20Worker%20routing",
          },
          {
            status: 400,
          }
        );
      }

      const result = await this.runCodingTask(prompt);

      return Response.json({
        ok: result.status !== "failed",
        ...result,
      });
    }

    return Response.json({
      ok: true,
      agent: "CodingAgent",
      routes: {
        status: "/api/agents/coding-agent/default/status",
        task: "/api/agents/coding-agent/default/task?prompt=Review%20my%20Worker%20routing",
        result: "/api/agents/coding-agent/default/result",
        reset: "/api/agents/coding-agent/default/reset",
      },
    });
  }
}
''')

print("==> Running TypeScript checks...")
subprocess.call(["pnpm", "run", "cf:types"])
subprocess.call(["pnpm", "run", "cf:typecheck"])

print("""
✅ CodingAgent long-running lifecycle patch applied.

Local test:
  lsof -ti :8787 | xargs -r kill -9
  pnpm run cf:dev

In another terminal:
  TOKEN="$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)"
  curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/agents/coding-agent/default/status
  curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data '{"prompt":"Review my Cloudflare Worker routing."}' http://localhost:8787/api/agents/coding-agent/default/task
  curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/agents/coding-agent/default/result

Deploy:
  pnpm run cf:deploy""")
