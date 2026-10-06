import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockGetConfig, mockFetch, mockRequireAdmin } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockFetch: vi.fn(),
  mockRequireAdmin: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.mock("@/lib/api-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.stubGlobal("fetch", mockFetch);

const CONFIGURED = {
  SOCIALAUTO_API_URL: "https://social.cloudless.gr",
  SOCIALAUTO_ADMIN_EMAIL: "admin@example.com",
  SOCIALAUTO_ADMIN_PASSWORD: "pw",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString("base64url");
  return `x.${payload}.y`;
}

/** Queue login + one upstream call, in that order. */
function mockLoginThen(body: unknown, status = 200) {
  mockFetch
    .mockResolvedValueOnce(jsonResponse({ access_token: fakeJwt() }))
    .mockResolvedValueOnce(jsonResponse(body, status));
}

const consolePayload = {
  checked_at: "2026-10-06T00:00:00Z",
  services: [{ name: "comfyui", online: true, detail: "200" }],
  accounts: [],
  publish_queue: { completed: 5 },
  media: { ai_generated_assets: 3, comfyui_queue: { pending: 0, running: 0 } },
  browser_orchestrator: {
    current_platform: null,
    queue_length: 0,
    lock_held: false,
    message: "Browser idle",
  },
  tiktok_audit: { status: "under_review" },
};

// socialauto.ts caches the admin JWT module-locally — reset modules per test
// so each test sees a fresh login + call pair.
async function loadLib() {
  return await import("@/lib/socialauto");
}
async function loadRoute() {
  return await import("@/app/api/admin/postiz/ops/route");
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  mockGetConfig.mockResolvedValue(CONFIGURED);
  mockRequireAdmin.mockResolvedValue({ ok: true });
});

describe("getOpsConsole", () => {
  it("fetches /ops/console with the admin bearer token", async () => {
    mockLoginThen(consolePayload);
    const { getOpsConsole } = await loadLib();
    const data = await getOpsConsole();
    expect(data.tiktok_audit?.status).toBe("under_review");
    const [url, init] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://social.cloudless.gr/api/v1/ops/console");
    expect((init.headers as Headers).get("Authorization")).toMatch(/^Bearer /);
  });

  it("throws SocialAutoApiError on upstream failure", async () => {
    mockLoginThen({ detail: "boom" }, 500);
    const { getOpsConsole } = await loadLib();
    await expect(getOpsConsole()).rejects.toThrow("SocialAuto API error 500");
  });
});

describe("runOpsAction", () => {
  it.each([
    ["session-heal", "/api/v1/ops/session-heal", "POST"],
    ["release-browser-lock", "/api/v1/ops/browser-orchestrator/release", "POST"],
  ] as const)("maps %s", async (action, path, method) => {
    mockLoginThen({ ok: true });
    const { runOpsAction } = await loadLib();
    await runOpsAction({ action });
    const [url, init] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(`https://social.cloudless.gr${path}`);
    expect(init.method).toBe(method);
  });

  it("PUTs tiktok audit updates", async () => {
    mockLoginThen({ updated: 1 });
    const { runOpsAction } = await loadLib();
    await runOpsAction({ action: "set-tiktok-audit", status: "approved", reference: "r1" });
    const [url, init] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://social.cloudless.gr/api/v1/ops/tiktok-audit");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body)).status).toBe("approved");
  });
});

describe("admin ops route", () => {
  const ctx = { params: Promise.resolve({}) };

  it("GET returns upstream console JSON for admins", async () => {
    mockLoginThen(consolePayload);
    const { GET } = await loadRoute();
    const req = new NextRequest("https://cloudless.gr/api/admin/postiz/ops");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).publish_queue.completed).toBe(5);
  });

  it("GET is rejected for non-admins", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    });
    const { GET } = await loadRoute();
    const req = new NextRequest("https://cloudless.gr/api/admin/postiz/ops");
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("POST rejects unknown actions before calling upstream", async () => {
    const { POST } = await loadRoute();
    const bad = new NextRequest("https://cloudless.gr/api/admin/postiz/ops", {
      method: "POST",
      body: JSON.stringify({ action: "rm-rf" }),
    });
    const res = await POST(bad, ctx);
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("POST maps allowlisted actions upstream", async () => {
    mockLoginThen({ released: true });
    const { POST } = await loadRoute();
    const ok = new NextRequest("https://cloudless.gr/api/admin/postiz/ops", {
      method: "POST",
      body: JSON.stringify({ action: "release-browser-lock" }),
    });
    const res = await POST(ok, ctx);
    expect(res.status).toBe(200);
    const [url] = mockFetch.mock.calls[1] as [string];
    expect(url).toContain("/ops/browser-orchestrator/release");
  });
});
