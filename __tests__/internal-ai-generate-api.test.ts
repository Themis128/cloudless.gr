/**
 * /api/internal/ai/generate — provider routing tests.
 *
 * Covers the contract that the weekly newsletter cron depends on:
 *   - 401 without the shared secret
 *   - 503 when the secret isn't configured
 *   - 400 with no user message
 *   - Cloudflare success path
 *   - Cloudflare failure → Bedrock fallback
 *   - Both providers failing → 502
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/ssm-config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ssm-config")>(
    "@/lib/ssm-config",
  );
  return { ...actual, getConfig: vi.fn() };
});
vi.mock("@/lib/bedrock-shared", () => ({
  getBedrockClient: vi.fn(),
  runBedrockTurn: vi.fn(),
  joinAssistantText: (blocks: { text?: string }[]) =>
    blocks.map((b) => b.text ?? "").join(""),
  BEDROCK_MODEL_ID: "us.anthropic.claude-3-5-haiku-20241022-v1:0",
}));

import { POST } from "../src/app/api/internal/ai/generate/route";
import { getConfig } from "@/lib/ssm-config";
import { runBedrockTurn } from "@/lib/bedrock-shared";

const SECRET = "test-internal-secret";

function reqWith(body: unknown, secret: string | null = SECRET): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers["x-internal-secret"] = secret;
  return new Request("http://localhost/api/internal/ai/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getConfig).mockResolvedValue({
    AI_GENERATE_SECRET: SECRET,
  } as Awaited<ReturnType<typeof getConfig>>);
  process.env.CLOUDFLARE_ACCOUNT_ID = "acct-test";
  process.env.CLOUDFLARE_API_TOKEN = "token-test";
});

describe("POST /api/internal/ai/generate", () => {
  it("returns 503 when AI_GENERATE_SECRET is not configured", async () => {
    vi.mocked(getConfig).mockResolvedValue({
      AI_GENERATE_SECRET: "",
    } as Awaited<ReturnType<typeof getConfig>>);
    const res = await POST(
      reqWith({ messages: [{ role: "user", content: "hi" }] }) as never,
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 when the secret header is missing or wrong", async () => {
    const a = await POST(
      reqWith({ messages: [{ role: "user", content: "hi" }] }, null) as never,
    );
    expect(a.status).toBe(401);
    const b = await POST(
      reqWith(
        { messages: [{ role: "user", content: "hi" }] },
        "wrong-secret",
      ) as never,
    );
    expect(b.status).toBe(401);
  });

  it("returns 400 with no user message", async () => {
    const res = await POST(reqWith({ messages: [] }) as never);
    expect(res.status).toBe(400);
  });

  it("returns Cloudflare result on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { response: "Hello world" } }),
        { status: 200 },
      ),
    ) as typeof fetch;
    const res = await POST(
      reqWith({
        messages: [{ role: "user", content: "say hi" }],
        system: "you are helpful",
      }) as never,
    );
    const body = (await res.json()) as {
      result: string;
      source: string;
      model: string;
    };
    expect(res.status).toBe(200);
    expect(body.source).toBe("cloudflare");
    expect(body.result).toBe("Hello world");
  });

  it("falls back to Bedrock when Cloudflare returns 500", async () => {
    globalThis.fetch = vi
      .fn()
      // First CF call (default model) → 500
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [{ message: "boom" }] }), {
          status: 500,
        }),
      )
      // Fallback CF model → also 500
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [{ message: "boom" }] }), {
          status: 500,
        }),
      ) as typeof fetch;
    vi.mocked(runBedrockTurn).mockResolvedValueOnce([{ text: "From Bedrock" }]);
    const res = await POST(
      reqWith({
        messages: [{ role: "user", content: "fallback please" }],
      }) as never,
    );
    const body = (await res.json()) as { result: string; source: string };
    expect(res.status).toBe(200);
    expect(body.source).toBe("bedrock");
    expect(body.result).toBe("From Bedrock");
  });

  it("returns 502 when every provider fails", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ errors: [{ message: "down" }] }), {
          status: 500,
        }),
      ) as typeof fetch;
    vi.mocked(runBedrockTurn).mockRejectedValueOnce(new Error("bedrock down"));
    const res = await POST(
      reqWith({
        messages: [{ role: "user", content: "try" }],
      }) as never,
    );
    expect(res.status).toBe(502);
  });
});
