import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetConfig, mockRequireAdmin, mockSaFetch } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockRequireAdmin: vi.fn(),
  mockSaFetch: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.mock("@/lib/api-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/socialauto", () => ({
  saFetch: mockSaFetch,
  SocialAutoNotConfiguredError: class SocialAutoNotConfiguredError extends Error {},
  SocialAutoApiError: class SocialAutoApiError extends Error {
    constructor(public status: number, public detail: string) { super(detail); }
  },
}));

import { POST as surveyPOST } from "@/app/api/survey/route";
import { GET as gatesGET, POST as gatesPOST } from "@/app/api/admin/socialauto-gates/route";
import { listPendingGates, approveGate, rejectGate } from "@/lib/socialauto-engagement";

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const CFG = {
  SOCIALAUTO_API_URL: "https://social.cloudless.gr",
  SOCIALAUTO_SERVICE_TOKEN: "id123:sekret",
};

function req(url: string, init?: RequestInit) {
  return new NextRequest(url, init as never);
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockGetConfig.mockResolvedValue(CFG);
  mockRequireAdmin.mockResolvedValue({ ok: true });
});

describe("api/survey", () => {
  it("rejects bad email", async () => {
    const r = await surveyPOST(req("http://x/api/survey", {
      method: "POST", body: JSON.stringify({ email: "nope" }),
    }) as never);
    expect(r.status).toBe(400);
  });

  it("honeypot short-circuits", async () => {
    const r = await surveyPOST(req("http://x/api/survey", {
      method: "POST", body: JSON.stringify({ email: "a@b.co", website: "spam" }),
    }) as never);
    expect((await r.json()).ok).toBe(true);
  });

  it("reports not_configured without service token", async () => {
    mockGetConfig.mockResolvedValue({});
    const r = await surveyPOST(req("http://x/api/survey", {
      method: "POST", body: JSON.stringify({ email: "a@b.co" }),
    }) as never);
    expect((await r.json()).forwarded.delivered).toBe("not_configured");
  });

  it("forwards a valid survey", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ ok: true })));
    const r = await surveyPOST(req("http://x/api/survey", {
      method: "POST",
      headers: { referer: "https://cloudless.gr/survey" },
      body: JSON.stringify({ email: "a@b.co", name: "A", answers: { stack: "AWS" }, consent: true }),
    }) as never);
    expect((await r.json()).forwarded.delivered).toBe("sent");
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toContain("/api/v1/leads/public/survey");
  });

  it("reports upstream_error on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({}, 502)));
    const r = await surveyPOST(req("http://x/api/survey", {
      method: "POST", body: JSON.stringify({ email: "a@b.co" }),
    }) as never);
    expect((await r.json()).forwarded.delivered).toBe("upstream_error");
  });
});

describe("api/admin/socialauto-gates", () => {
  it("GET lists pending gates", async () => {
    mockSaFetch.mockResolvedValue(okJson([{ id: "1", platform: "linkedin" }]));
    const r = await gatesGET(req("http://x/api/admin/socialauto-gates"));
    expect((await r.json()).items).toHaveLength(1);
  });

  it("GET 502s when upstream fails", async () => {
    mockSaFetch.mockResolvedValue(okJson({}, 500));
    const r = await gatesGET(req("http://x/api/admin/socialauto-gates"));
    expect(r.status).toBe(502);
  });

  it("POST approves with draft", async () => {
    mockSaFetch.mockResolvedValue(okJson({ id: "1", status: "approved" }));
    const r = await gatesPOST(req("http://x/api/admin/socialauto-gates", {
      method: "POST", body: JSON.stringify({ id: "1", op: "approve", comment_draft: "hi" }),
    }));
    expect((await r.json()).item.status).toBe("approved");
  });

  it("POST rejects", async () => {
    mockSaFetch.mockResolvedValue(okJson({ id: "2", status: "rejected" }));
    const r = await gatesPOST(req("http://x/api/admin/socialauto-gates", {
      method: "POST", body: JSON.stringify({ id: "2", op: "reject" }),
    }));
    expect((await r.json()).item.status).toBe("rejected");
  });
});

describe("socialauto-engagement lib", () => {
  it("listPendingGates returns items", async () => {
    mockSaFetch.mockResolvedValue(okJson([{ id: "g1" }]));
    expect(await listPendingGates()).toEqual([{ id: "g1" }]);
  });
  it("approveGate posts draft", async () => {
    mockSaFetch.mockResolvedValue(okJson({ id: "g1" }));
    await approveGate("g1", "draft");
    const init = mockSaFetch.mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({ comment_draft: "draft" });
  });
  it("rejectGate throws on !ok", async () => {
    mockSaFetch.mockResolvedValue(okJson({}, 500));
    await expect(rejectGate("g1")).rejects.toThrow("reject");
  });
  it("listPendingGates throws on !ok", async () => {
    mockSaFetch.mockResolvedValue(okJson({}, 403));
    await expect(listPendingGates()).rejects.toThrow("pending gates");
  });
});

describe("admin agency analytics page", () => {
  it("renders metrics board", async () => {
    const { renderToString } = await import("react-dom/server");
    mockSaFetch.mockResolvedValue(okJson({
      tcd_eur: 31.5, tsr_pct: 99.2, ppl_active: 4, alv_minutes: 7, hipc_weekly: 0, period: "7d",
    }));
    const mod = await import("@/app/[locale]/admin/analytics/agency/page");
    const el = await mod.default();
    const html = renderToString(el);
    expect(html).toContain("Agent Operations");
    expect(html).toContain("99.2%");
  });

  it("renders unavailable state", async () => {
    const { renderToString } = await import("react-dom/server");
    mockSaFetch.mockResolvedValue(okJson({}, 500));
    const mod = await import("@/app/[locale]/admin/analytics/agency/page");
    const html = renderToString(await mod.default());
    expect(html).toContain("unavailable");
  });

  it("renders unavailable when saFetch throws", async () => {
    const { renderToString } = await import("react-dom/server");
    mockSaFetch.mockRejectedValue(new Error("boom"));
    const mod = await import("@/app/[locale]/admin/analytics/agency/page");
    const html = renderToString(await mod.default());
    expect(html).toContain("unavailable");
  });
});

describe("uncovered edge paths", () => {
  it("gates POST 502s when upstream throws", async () => {
    mockSaFetch.mockRejectedValue(new Error("network down"));
    const r = await gatesPOST(
      req("http://x/api/admin/socialauto-gates", {
        method: "POST",
        body: JSON.stringify({ id: "g1", op: "approve" }),
      }) as never
    );
    expect(r.status).toBe(502);
  });

  it("approveGate throws on !ok", async () => {
    mockSaFetch.mockResolvedValue(okJson({}, 500));
    await expect(approveGate("g1", "draft")).rejects.toThrow(/approve/);
  });

  it("approveGate succeeds without draft", async () => {
    mockSaFetch.mockResolvedValue(okJson({ id: "g1", status: "approved" }));
    const item = await approveGate("g1");
    expect((item as { status: string }).status).toBe("approved");
  });

  it("survey POST 502s when forward fetch throws", async () => {
    mockGetConfig.mockResolvedValue(CFG);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("dns")));
    await expect(
      surveyPOST(
        req("http://x/api/survey", {
          method: "POST",
          body: JSON.stringify({ email: "a@b.co", consent: true, answers: {} }),
        }) as never
      )
    ).rejects.toThrow("dns");
    vi.unstubAllGlobals();
  });
});
