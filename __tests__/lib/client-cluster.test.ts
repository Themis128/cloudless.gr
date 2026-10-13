import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  recordAdminAiCall: vi.fn(),
  getAuthDbFromEnv: vi.fn(),
  allowDiscretionaryD1Write: vi.fn(),
  funnelImpressionsEnabled: vi.fn(),
  passSample: vi.fn(),
}));

vi.mock("@/lib/admin-ai-usage", () => ({ recordAdminAiCall: m.recordAdminAiCall }));
vi.mock("@/lib/auth-d1", () => ({ getAuthDbFromEnv: m.getAuthDbFromEnv }));
vi.mock("@/lib/d1-write-budget", () => ({
  allowDiscretionaryD1Write: m.allowDiscretionaryD1Write,
  funnelImpressionsEnabled: m.funnelImpressionsEnabled,
  passSample: m.passSample,
}));

import { isOllamaConfigured, callOllamaChat } from "@/lib/ollama-client";
import { isNvidiaProxyConfigured, callNvidiaProxyChat } from "@/lib/nvidia-proxy-client";
import {
  hasAnalyticsConsent,
  getFunnelSessionId,
  trackPageView,
  trackFunnelEvent,
} from "@/lib/funnel-client";
import { buildPayloadForSmokeTest, normalizeAndValidatePrompt, CLIENT_ID } from "@/lib/comfyui";
import { escapeCsvCell, rowsToCsv, downloadCsvFile } from "@/lib/csv-export";
import {
  isFunnelEventType,
  normalizeFunnelEvent,
  recordFunnelEvent,
  getFunnelSummary,
} from "@/lib/search-funnel";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_MODEL;
  delete process.env.NVIDIA_PROXY_URL;
  delete process.env.NVIDIA_PROXY_TOKEN;
  delete process.env.REPLICATE_API_TOKEN;
  delete process.env.COMFYUI_CHECKPOINT;
  m.passSample.mockReturnValue(true);
  m.allowDiscretionaryD1Write.mockReturnValue(true);
  m.funnelImpressionsEnabled.mockReturnValue(false);
  m.getAuthDbFromEnv.mockReturnValue(null);
});

describe("ollama-client", () => {
  it("reflects config and rejects unconfigured calls", async () => {
    expect(isOllamaConfigured()).toBe(false);
    await expect(callOllamaChat([{ role: "user", content: "hi" }])).rejects.toThrow(
      "Ollama not configured"
    );
    process.env.OLLAMA_BASE_URL = "http://ollama:11434";
    expect(isOllamaConfigured()).toBe(true);
  });

  it("posts chat completions and records usage", async () => {
    process.env.OLLAMA_BASE_URL = "http://ollama:11434";
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: " reply " } }] }))
    );
    const out = await callOllamaChat([{ role: "user", content: "hi" }], { maxTokens: 42 });
    expect(out).toBe("reply");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://ollama:11434/v1/chat/completions");
    expect(JSON.parse(init.body)).toMatchObject({
      model: "qwen2.5-coder:latest",
      max_tokens: 42,
      stream: false,
    });
    expect(m.recordAdminAiCall).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it("records failures for HTTP errors and fetch throws", async () => {
    process.env.OLLAMA_BASE_URL = "http://ollama:11434";
    mockFetch.mockResolvedValueOnce(new Response("broken", { status: 502 }));
    await expect(callOllamaChat([])).rejects.toThrow("Ollama HTTP 502");
    mockFetch.mockRejectedValueOnce(new Error("conn reset"));
    await expect(callOllamaChat([])).rejects.toThrow("conn reset");
    expect(m.recordAdminAiCall).toHaveBeenCalledTimes(2);
    expect(m.recordAdminAiCall.mock.calls[1][0].ok).toBe(false);

    // empty response text → fallback message
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [] })));
    expect(await callOllamaChat([])).toContain("could not generate");
  });
});

describe("nvidia-proxy-client", () => {
  it("requires both URL and token", async () => {
    expect(isNvidiaProxyConfigured()).toBe(false);
    await expect(callNvidiaProxyChat([])).rejects.toThrow("NVIDIA proxy not configured");
    process.env.NVIDIA_PROXY_URL = "http://proxy";
    expect(isNvidiaProxyConfigured()).toBe(false);
    process.env.NVIDIA_PROXY_TOKEN = "tok";
    expect(isNvidiaProxyConfigured()).toBe(true);
  });

  it("sends bearer + thinking flag, marks 401/403 as unauthorized", async () => {
    process.env.NVIDIA_PROXY_URL = "http://proxy";
    process.env.NVIDIA_PROXY_TOKEN = "tok";
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }))
    );
    expect(await callNvidiaProxyChat([{ role: "user", content: "x" }])).toBe("ok");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://proxy/chat/completions?thinking=1");
    expect(init.headers.Authorization).toBe("Bearer tok");

    for (const status of [401, 403, 500]) {
      mockFetch.mockResolvedValueOnce(new Response("nope", { status }));
      await expect(callNvidiaProxyChat([])).rejects.toThrow(`NVIDIA proxy HTTP ${status}`);
    }
    const calls = m.recordAdminAiCall.mock.calls.map((c) => c[0]);
    expect(calls.filter((c) => c.ok === false)).toHaveLength(3);
  });

  it("records fetch-throw failures and empty-reply fallback", async () => {
    process.env.NVIDIA_PROXY_URL = "http://proxy";
    process.env.NVIDIA_PROXY_TOKEN = "tok";
    mockFetch.mockRejectedValueOnce(new Error("dns"));
    await expect(callNvidiaProxyChat([])).rejects.toThrow("dns");
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({})));
    expect(await callNvidiaProxyChat([])).toContain("could not generate");
  });
});

describe("funnel-client", () => {
  it("reads consent from the cookieConsent cookie", () => {
    expect(hasAnalyticsConsent()).toBe(false);
    document.cookie = `cookieConsent=${encodeURIComponent(JSON.stringify({ analytics: true }))}`;
    expect(hasAnalyticsConsent()).toBe(true);
    document.cookie = `cookieConsent=${encodeURIComponent("bad json")}`;
    expect(hasAnalyticsConsent()).toBe(false);
    document.cookie = `cookieConsent=${encodeURIComponent(JSON.stringify({ analytics: false }))}`;
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("persists a session id in sessionStorage", () => {
    sessionStorage.clear();
    const id1 = getFunnelSessionId();
    expect(id1).toBeTruthy();
    expect(getFunnelSessionId()).toBe(id1);
    sessionStorage.setItem("cloudless_funnel_sid", "fixed");
    expect(getFunnelSessionId()).toBe("fixed");
  });

  it("beacons page_view + funnel events only with consent", () => {
    trackPageView();
    trackFunnelEvent("search_click", { product_id: "p1" });
    expect(mockFetch).not.toHaveBeenCalled();

    document.cookie = `cookieConsent=${encodeURIComponent(JSON.stringify({ analytics: true }))}`;
    sessionStorage.clear();
    mockFetch.mockResolvedValue(new Response("{}"));
    trackPageView();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/track");
    const body = JSON.parse(init.body);
    expect(body.type).toBe("page_view");
    expect(body.session_id).toBeTruthy();

    trackFunnelEvent("search_buy", { product_id: "p9" });
    const [url2, init2] = mockFetch.mock.calls[1];
    expect(url2).toBe("/api/analytics/track");
    expect(JSON.parse(init2.body)).toMatchObject({
      event: "search_buy",
      properties: { product_id: "p9" },
    });
  });
});

describe("comfyui", () => {
  it("builds the local CPU payload by default", () => {
    const { client_id, prompt } = buildPayloadForSmokeTest();
    expect(client_id).toBe(CLIENT_ID);
    const types = Object.values(prompt).map((n) => n.class_type);
    expect(types).toContain("CheckpointLoaderSimple");
    expect(types).toContain("KSampler");
    expect(prompt["3"].inputs?.ckpt_name).toBe("sd_xl_base_1.0.safetensors");
  });

  it("honours COMFYUI_CHECKPOINT and the Replicate branch", () => {
    process.env.COMFYUI_CHECKPOINT = "custom.safetensors";
    expect(buildPayloadForSmokeTest().prompt["3"].inputs?.ckpt_name).toBe("custom.safetensors");
    process.env.REPLICATE_API_TOKEN = "r8_tok";
    const rep = buildPayloadForSmokeTest();
    const types = Object.values(rep.prompt).map((n) => n.class_type);
    expect(types).toContain("Replicate black-forest-labs/flux-schnell");
    expect(rep.prompt["2"].inputs?.api_key).toBe("r8_tok");
  });

  it("normalizes legacy class names and rejects malformed nodes", () => {
    const ok = normalizeAndValidatePrompt({
      a: { class_type: "PrimitiveNode", inputs: { value: "x" } },
      b: { class_type: "String Constant", inputs: { link: ["a", 0] } },
      c: { class_type: "Keep", inputs: { links: [["a", 0], ["b", 1]] } },
    });
    expect(ok.a.class_type).toBe("Primitive");
    expect(ok.b.class_type).toBe("PrimitiveString");
    expect(ok.c.class_type).toBe("Keep");

    expect(() =>
      normalizeAndValidatePrompt({ a: null as unknown as Record<string, unknown> })
    ).toThrow("expected object");
    expect(() => normalizeAndValidatePrompt({ a: { inputs: {} } })).toThrow("Missing class_type");
    expect(() => normalizeAndValidatePrompt({ a: { class_type: "X" } })).toThrow(
      "Missing or invalid inputs"
    );
    expect(() =>
      normalizeAndValidatePrompt({ a: { class_type: "X", inputs: { bad: [1, 2, 3] } } })
    ).toThrow("Invalid connection array");
  });
});

describe("csv-export", () => {
  it("escapes RFC 4180 cells", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(true)).toBe("true");
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("a,b\nc")).toBe('"a,b\nc"');
  });

  it("renders header + rows with CRLF", () => {
    const csv = rowsToCsv(
      [
        { key: "a", label: "Alpha" },
        { key: "b", label: "B,eta" },
      ],
      [
        { a: "1", b: "x" },
        { a: 'q"z', b: null },
      ]
    );
    expect(csv).toBe('Alpha,"B,eta"\r\n1,x\r\n"q""z",');
  });

  it("downloads via an anchor click", () => {
    const realURL = globalThis.URL;
    const clicks: string[] = [];
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:csv"),
      revokeObjectURL: vi.fn(),
    });
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") el.click = () => clicks.push((el as HTMLAnchorElement).download);
      return el;
    });
    downloadCsvFile("gold.csv", "a,b");
    expect(clicks).toEqual(["gold.csv"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    vi.stubGlobal("URL", realURL);
    vi.restoreAllMocks();
  });
});

describe("search-funnel", () => {
  const fakeDb = () => {
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const all = vi.fn(async () => ({ results: [{ event_type: "search_query", count: 3, ab_variant: null }] }));
    return {
      run,
      all,
      prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run, all })) })),
    };
  };

  it("validates + clamps funnel event input", () => {
    expect(isFunnelEventType("search_query")).toBe(true);
    expect(isFunnelEventType("nope")).toBe(false);
    expect(normalizeFunnelEvent({})).toBeNull();
    expect(normalizeFunnelEvent({ event_type: "search_query" })).toBeNull();
    expect(normalizeFunnelEvent({ event_type: "bad", session_id: "s" })).toBeNull();
    const n = normalizeFunnelEvent({
      event_type: "search_result",
      session_id: "  sid  ",
      query: " q ".repeat(200),
      result_ids: ["a", 5 as unknown as string, "b"],
      result_count: 9999,
      ab_variant: "v1",
    });
    expect(n?.session_id).toBe("sid");
    expect(n?.result_ids).toEqual(["a", "b"]);
    expect(n?.result_count).toBe(1000);
    expect(n?.ab_variant).toBe("v1");
    // result_count falls back to result_ids length
    const n2 = normalizeFunnelEvent({
      event_type: "search_result",
      session_id: "s",
      result_ids: ["x", "y", "z"],
    });
    expect(n2?.result_count).toBe(3);
  });

  it("skips writes on gates, inserts when open", async () => {
    const db = fakeDb();
    m.getAuthDbFromEnv.mockReturnValue(db);
    // rec_impression gated off
    expect(
      await recordFunnelEvent({ event_type: "rec_impression", session_id: "s" })
    ).toBe(false);
    m.funnelImpressionsEnabled.mockReturnValue(true);
    // sample gate
    m.passSample.mockReturnValueOnce(false);
    expect(await recordFunnelEvent({ event_type: "search_query", session_id: "s" })).toBe(false);
    // budget gate
    m.allowDiscretionaryD1Write.mockReturnValueOnce(false);
    expect(await recordFunnelEvent({ event_type: "search_query", session_id: "s" })).toBe(false);
    // no db
    m.getAuthDbFromEnv.mockReturnValueOnce(null);
    expect(await recordFunnelEvent({ event_type: "search_query", session_id: "s" })).toBe(false);
    // invalid event
    expect(await recordFunnelEvent({ event_type: "nope" as never, session_id: "s" })).toBe(false);
    // happy path
    expect(
      await recordFunnelEvent({
        event_type: "search_click",
        session_id: "s",
        query: "cloud",
        result_ids: ["p1"],
        product_id: "p1",
      })
    ).toBe(true);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("search_funnel_events"));
    // insert failure → warn + false
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.run.mockRejectedValueOnce(new Error("db\u0007down"));
    expect(await recordFunnelEvent({ event_type: "search_query", session_id: "s" })).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("D1 insert failed"), "dbdown");
    warn.mockRestore();
  });

  it("summarizes funnel rows and tolerates failures", async () => {
    expect(await getFunnelSummary()).toBeNull();
    const db = fakeDb();
    m.getAuthDbFromEnv.mockReturnValue(db);
    expect(await getFunnelSummary(7)).toEqual([
      { event_type: "search_query", count: 3, ab_variant: null },
    ]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.all.mockRejectedValueOnce(new Error("boom"));
    expect(await getFunnelSummary()).toBeNull();
    warn.mockRestore();
  });
});

describe("langgraph-client stub", () => {
  it("every stub function rejects with the not-installed error", async () => {
    const lg = await import("@/lib/langgraph-client");
    const names = Object.keys(lg).filter(
      (k) => typeof (lg as Record<string, unknown>)[k] === "function"
    );
    expect(names.length).toBeGreaterThan(15);
    for (const name of names) {
      await expect(
        (lg as Record<string, (...a: never[]) => Promise<never>>)[name]()
      ).rejects.toThrow("@langchain/langgraph-sdk is not installed");
    }
  });
});
