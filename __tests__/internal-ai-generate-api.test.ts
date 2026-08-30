/**
 * /api/internal/ai/generate — Cloudflare Workers AI only.
 *
 * Covers the contract that the weekly newsletter cron depends on:
 *   - 401 without the shared secret
 *   - 503 when the secret isn't configured
 *   - 400 with no user message
 *   - Cloudflare success path
 *   - Both CF models failing → 502 (no Bedrock fallback)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/ssm-config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ssm-config")>("@/lib/ssm-config");
  return { ...actual, getConfig: vi.fn() };
});

import { POST } from "../src/app/api/internal/ai/generate/route";
import { getConfig } from "@/lib/ssm-config";

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
    const res = await POST(reqWith({ messages: [{ role: "user", content: "hi" }] }) as never);
    expect(res.status).toBe(503);
  });

  it("returns 401 when the secret header is missing or wrong", async () => {
    const a = await POST(reqWith({ messages: [{ role: "user", content: "hi" }] }, null) as never);
    expect(a.status).toBe(401);
    const b = await POST(
      reqWith({ messages: [{ role: "user", content: "hi" }] }, "wrong-secret") as never
    );
    expect(b.status).toBe(401);
  });

  it("returns 400 with no user message", async () => {
    const res = await POST(reqWith({ messages: [] }) as never);
    expect(res.status).toBe(400);
  });

  it("returns Cloudflare result on success", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { response: "Hello world" } }), { status: 200 })
      ) as typeof fetch;
    const res = await POST(
      reqWith({
        messages: [{ role: "user", content: "say hi" }],
        system: "you are helpful",
      }) as never
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

  it("falls back to the secondary CF model when the primary returns 500", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [{ message: "boom" }] }), {
          status: 500,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { response: "From fallback CF" } }), {
          status: 200,
        })
      ) as typeof fetch;
    const res = await POST(
      reqWith({
        messages: [{ role: "user", content: "fallback please" }],
      }) as never
    );
    const body = (await res.json()) as { result: string; source: string };
    expect(res.status).toBe(200);
    expect(body.source).toBe("cloudflare");
    expect(body.result).toBe("From fallback CF");
  });

  it("returns 502 when every CF model fails", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ errors: [{ message: "down" }] }), {
          status: 500,
        })
      )
    ) as typeof fetch;
    const res = await POST(
      reqWith({
        messages: [{ role: "user", content: "try" }],
      }) as never
    );
    expect(res.status).toBe(502);
  });
});

describe("POST /api/internal/ai/generate — non-string Cloudflare response", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getConfig).mockResolvedValue({
      AI_GENERATE_SECRET: SECRET,
    } as Awaited<ReturnType<typeof getConfig>>);
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct-test";
    process.env.CLOUDFLARE_API_TOKEN = "token-test";
  });

  it.each([
    ["../../@evil.example.com/x", "path traversal + URL rehosting"],
    ["@cf/meta/../../../etc/passwd", "path traversal"],
    ["http://attacker.com/", "absolute URL"],
    ["@cf/meta/llama?host=evil.com", "query string injection"],
    ["@cf/meta/llama#evil", "fragment injection"],
    ["@cf/meta /llama", "whitespace"],
    ["", "empty string"],
  ])("rejects untrusted model %j (%s) with 400 and no outbound fetch", async (badModel) => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const res = await POST(
      reqWith({
        model: badModel,
        messages: [{ role: "user", content: "hi" }],
      }) as never
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the canonical allowlisted model id", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { response: "ok" } }), { status: 200 })
      ) as typeof fetch;
    const res = await POST(
      reqWith({
        model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        messages: [{ role: "user", content: "hi" }],
      }) as never
    );
    expect(res.status).toBe(200);
  });

  it("stringifies a non-string Cloudflare response instead of throwing", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: { response: { json: "shape", with: ["nested", "arr"] } },
        }),
        { status: 200 }
      )
    ) as typeof fetch;
    const res = await POST(
      reqWith({
        messages: [{ role: "user", content: "hi" }],
      }) as never
    );
    const body = (await res.json()) as { result: string; source: string };
    expect(res.status).toBe(200);
    expect(body.source).toBe("cloudflare");
    expect(typeof body.result).toBe("string");
    expect(body.result).toContain('"json":"shape"');
  });
});
