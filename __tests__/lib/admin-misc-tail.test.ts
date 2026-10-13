import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  isWorkersAiConfigured: vi.fn(),
  callWorkersAiEmbed: vi.fn(),
  callWorkersAiChat: vi.fn(),
  isNvidiaProxyConfigured: vi.fn(),
  callNvidiaProxyChat: vi.fn(),
  isOllamaConfigured: vi.fn(),
  callOllamaChat: vi.fn(),
  callGemini: vi.fn(),
  getGeminiApiKey: vi.fn(),
  getFaqs: vi.fn(),
  getDocs: vi.fn(),
  requireAuth: vi.fn(),
  isAdmin: vi.fn(),
  readJsonConfig: vi.fn(),
  writeJsonConfig: vi.fn(),
  cookiesGet: vi.fn(),
}));

vi.mock("@/lib/workers-ai-client", () => ({
  isWorkersAiConfigured: m.isWorkersAiConfigured,
  callWorkersAiEmbed: m.callWorkersAiEmbed,
  callWorkersAiChat: m.callWorkersAiChat,
}));
vi.mock("@/lib/nvidia-proxy-client", () => ({
  isNvidiaProxyConfigured: m.isNvidiaProxyConfigured,
  callNvidiaProxyChat: m.callNvidiaProxyChat,
}));
vi.mock("@/lib/ollama-client", () => ({
  isOllamaConfigured: m.isOllamaConfigured,
  callOllamaChat: m.callOllamaChat,
}));
vi.mock("@/lib/gemini-admin", () => ({
  callGemini: m.callGemini,
  getGeminiApiKey: m.getGeminiApiKey,
}));
vi.mock("@/lib/appflowy-faqs", () => ({ getFaqs: m.getFaqs }));
vi.mock("@/lib/appflowy-docs", () => ({ getDocs: m.getDocs }));
vi.mock("@/lib/api-auth", () => ({ requireAuth: m.requireAuth, isAdmin: m.isAdmin }));
vi.mock("@/lib/app-config-json", () => ({
  readJsonConfig: m.readJsonConfig,
  writeJsonConfig: m.writeJsonConfig,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: m.cookiesGet }),
}));

import { syncAppFlowyToVectorize } from "@/lib/admin-vectorize";
import {
  isAdminAiConfigured,
  isAdminAiConfiguredAsync,
  generateAdminAiText,
  adminAiNotConfiguredResponse,
} from "@/lib/admin-ai";
import { listParquetPartitions, getParquetPresignedUrl } from "@/lib/analytics-duckdb";
import {
  readWorkspaces,
  writeWorkspaces,
  getActiveWorkspaceId,
  getActiveWorkspace,
  checkWorkspaceAccess,
  requireWorkspaceAdmin,
  resetWorkspaceCache,
} from "@/lib/workspace-server";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  resetWorkspaceCache();
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.GEMINI_API_KEY;
  m.isWorkersAiConfigured.mockReturnValue(false);
  m.isNvidiaProxyConfigured.mockReturnValue(false);
  m.isOllamaConfigured.mockReturnValue(false);
  m.getGeminiApiKey.mockResolvedValue(null);
  m.readJsonConfig.mockResolvedValue([]);
  m.writeJsonConfig.mockResolvedValue(undefined);
});

describe("syncAppFlowyToVectorize", () => {
  beforeEach(() => {
    m.isWorkersAiConfigured.mockReturnValue(true);
    m.callWorkersAiEmbed.mockResolvedValue([0.1, 0.2]);
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    process.env.CLOUDFLARE_API_TOKEN = "tok";
  });

  it("collects FAQs + docs and batch-upserts in chunks of 10", async () => {
    m.getFaqs.mockResolvedValue([
      { id: "f1", question: "Q1", answer: "A1" },
      { id: "f2", question: "Q2", answer: "  " }, // skipped: blank answer
    ]);
    m.getDocs.mockResolvedValue([
      { id: "d1", slug: "doc-one", title: "Doc1", description: "body" },
      { slug: "doc-two", title: "Doc2", description: "" }, // skipped: no body
    ]);
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    const out = await syncAppFlowyToVectorize();
    expect(out.upserted).toBe(2);
    const vectors = JSON.parse(mockFetch.mock.calls[0][1].body).vectors;
    expect(vectors[0].id).toBe("faq:f1");
    expect(vectors[0].metadata.source).toBe("appflowy-faq");
    expect(vectors[1].id).toBe("doc:d1");
    expect(vectors[1].metadata.source).toBe("appflowy-doc");
  });

  it("warns and continues when a source fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    m.getFaqs.mockRejectedValue(new Error("appflowy down"));
    m.getDocs.mockResolvedValue([{ id: "d", title: "T", description: "x" }]);
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    expect((await syncAppFlowyToVectorize()).upserted).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("FAQ sync skipped"), expect.any(Error));
    warn.mockRestore();
  });
});

describe("generateAdminAiText provider chain", () => {
  it("returns nvidia-proxy first when configured", async () => {
    m.isNvidiaProxyConfigured.mockReturnValue(true);
    m.callNvidiaProxyChat.mockResolvedValue("nv reply");
    const out = await generateAdminAiText("hi", { system: " sys " });
    expect(out).toEqual({ text: "nv reply", provider: "nvidia-proxy" });
    expect(m.callNvidiaProxyChat).toHaveBeenCalledWith(
      [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      { maxTokens: 1000 }
    );
  });

  it("falls through nvidia → workers-ai → ollama → gemini", async () => {
    m.isNvidiaProxyConfigured.mockReturnValue(true);
    m.callNvidiaProxyChat.mockRejectedValue(new Error("nv down"));
    m.isWorkersAiConfigured.mockReturnValue(true);
    m.callWorkersAiChat.mockResolvedValue("  "); // empty → falls through
    m.isOllamaConfigured.mockReturnValue(true);
    m.callOllamaChat.mockRejectedValue(new Error("ollama down"));
    m.getGeminiApiKey.mockResolvedValue("gkey");
    m.callGemini.mockResolvedValue("gem reply");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await generateAdminAiText("hi", { system: "S", maxTokens: 9 });
    expect(out).toEqual({ text: "gem reply", provider: "gemini" });
    expect(m.callGemini).toHaveBeenCalledWith("S\n\nhi", "gkey", 9);
    warn.mockRestore();
  });

  it("returns workers-ai and ollama providers on their turns", async () => {
    m.isWorkersAiConfigured.mockReturnValue(true);
    m.callWorkersAiChat.mockResolvedValue("wai");
    expect((await generateAdminAiText("p")).provider).toBe("workers-ai");

    m.isWorkersAiConfigured.mockReturnValue(false);
    m.isOllamaConfigured.mockReturnValue(true);
    m.callOllamaChat.mockResolvedValue("ol");
    expect((await generateAdminAiText("p")).provider).toBe("ollama");
  });

  it("throws AdminAiNotConfigured when nothing works", async () => {
    await expect(generateAdminAiText("p")).rejects.toMatchObject({
      name: "AdminAiNotConfigured",
    });
    // env fallback for the gemini key
    process.env.GEMINI_API_KEY = "envkey";
    m.callGemini.mockResolvedValue("env reply");
    expect((await generateAdminAiText("p")).provider).toBe("gemini");
    expect(m.callGemini).toHaveBeenCalledWith("p", "envkey", 1000);
  });

  it("reports configuration + 503 helper", async () => {
    expect(isAdminAiConfigured()).toBe(false);
    expect(await isAdminAiConfiguredAsync()).toBe(false);
    m.isOllamaConfigured.mockReturnValue(true);
    expect(isAdminAiConfigured()).toBe(true);
    expect(await isAdminAiConfiguredAsync()).toBe(true);
    m.isOllamaConfigured.mockReturnValue(false);
    m.getGeminiApiKey.mockResolvedValue("k");
    expect(await isAdminAiConfiguredAsync()).toBe(true);
    const res = adminAiNotConfiguredResponse();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("NVIDIA_PROXY_URL");
  });
});

describe("analytics-duckdb partitions", () => {
  it("walks R2 pagination and sorts newest first", async () => {
    const lists = [
      {
        objects: [
          { key: "analytics/year=2025/month=01/day=02/a.parquet" },
          { key: "analytics/other/x.parquet" }, // non-matching
        ],
        truncated: true,
        cursor: "c1",
      },
      {
        objects: [{ key: "analytics/year=2026/month=03/day=04/b.parquet" }],
        truncated: false,
      },
    ];
    const list = vi.fn();
    for (const r of lists) list.mockResolvedValueOnce(r);
    const r2 = { list } as unknown as R2Bucket;
    const out = await listParquetPartitions(r2);
    expect(out.map((p) => p.key)).toEqual([
      "analytics/year=2026/month=03/day=04/b.parquet",
      "analytics/year=2025/month=01/day=02/a.parquet",
    ]);
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[1][0].cursor).toBe("c1");
    expect(out[0]).toMatchObject({ year: "2026", month: "03", day: "04" });
  });

  it("returns null presigned URL placeholder", async () => {
    expect(await getParquetPresignedUrl({} as R2Bucket, "k")).toBeNull();
  });
});

describe("workspace-server", () => {
  const ws = {
    id: "w1",
    name: "Acme",
    slug: "acme",
    description: "",
    adminEmails: ["admin@acme.co"],
    createdAt: "2026-01-01",
  };

  it("reads + caches workspaces, writes through", async () => {
    m.readJsonConfig.mockResolvedValue([ws]);
    expect(await readWorkspaces()).toEqual([ws]);
    expect(await readWorkspaces()).toEqual([ws]);
    expect(m.readJsonConfig).toHaveBeenCalledTimes(1); // cached

    await writeWorkspaces([ws]);
    expect(m.writeJsonConfig).toHaveBeenCalledWith(
      "WORKSPACES_JSON",
      [ws],
      "Multi-tenant workspaces"
    );
  });

  it("resolves the active workspace id from request cookie or RSC store", async () => {
    const req = {
      cookies: { get: (k: string) => (k === "cloudless_workspace_id" ? { value: "w1" } : undefined) },
    };
    expect(await getActiveWorkspaceId(req as never)).toBe("w1");

    m.cookiesGet.mockReturnValue({ value: "w2" });
    expect(await getActiveWorkspaceId()).toBe("w2");
    m.cookiesGet.mockReturnValue(undefined);
    expect(await getActiveWorkspaceId()).toBeNull();
  });

  it("getActiveWorkspace looks the cookie id up in the list", async () => {
    m.readJsonConfig.mockResolvedValue([ws]);
    m.cookiesGet.mockReturnValue({ value: "w1" });
    expect(await getActiveWorkspace()).toEqual(ws);
    m.cookiesGet.mockReturnValue({ value: "gone" });
    resetWorkspaceCache();
    expect(await getActiveWorkspace()).toBeNull();
    m.cookiesGet.mockReturnValue(undefined);
    expect(await getActiveWorkspace()).toBeNull();
  });

  it("checkWorkspaceAccess covers all three decisions", () => {
    const user = { email: "ADMIN@acme.co" } as never;
    expect(checkWorkspaceAccess(user, null, false)).toBe("no_workspace");
    expect(checkWorkspaceAccess(user, ws, true)).toBe("granted");
    expect(checkWorkspaceAccess(user, ws, false)).toBe("granted"); // case-insensitive
    expect(checkWorkspaceAccess({ email: "x@y.z" } as never, ws, false)).toBe("forbidden");
    expect(checkWorkspaceAccess({} as never, ws, false)).toBe("forbidden");
  });

  it("requireWorkspaceAdmin walks the full decision tree", async () => {
    const req = {
      cookies: { get: (k: string) => (k === "cloudless_workspace_id" ? { value: "w1" } : undefined) },
    } as never;
    m.readJsonConfig.mockResolvedValue([ws]);

    m.requireAuth.mockResolvedValue({ ok: false, response: new Response("x", { status: 401 }) });
    const denied = await requireWorkspaceAdmin(req);
    expect(denied.ok).toBe(false);

    // no workspace → 400
    m.requireAuth.mockResolvedValue({ ok: true, user: { email: "a@b.c" } });
    m.isAdmin.mockReturnValue(false);
    const noWs = {
      cookies: { get: () => undefined },
    } as never;
    const r1 = await requireWorkspaceAdmin(noWs);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.response.status).toBe(400);

    // workspace exists, not admin → 403
    const r2 = await requireWorkspaceAdmin(req);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.response.status).toBe(403);

    // workspace admin → granted
    m.requireAuth.mockResolvedValue({ ok: true, user: { email: "admin@acme.co" } });
    const r3 = await requireWorkspaceAdmin(req);
    expect(r3).toMatchObject({ ok: true, workspace: ws });

    // global admin → granted
    m.requireAuth.mockResolvedValue({ ok: true, user: { email: "root@cloudless.gr" } });
    m.isAdmin.mockReturnValue(true);
    const r4 = await requireWorkspaceAdmin(req);
    expect(r4.ok).toBe(true);
  });
});
