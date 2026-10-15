/**
 * socialauto-public-leads.ts — CF-Access-token resolution, redirect-to-Access
 * detection, and the ForwardResult reason mapping. Fakes at getConfig + fetch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({ getConfig: (...a: unknown[]) => mockGetConfig(...a) }));
vi.mock("server-only", () => ({}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { forwardPlaybookLead, resolveLeadsTarget, PUBLIC_PLAYBOOK_URL } from "@/lib/socialauto-public-leads";

const input = { email: "a@x", name: "Ana", consentAt: "2026-10-11T00:00:00Z", pagePath: "/p", locale: "en" };

const CFG = {
  SOCIALAUTO_SERVICE_TOKEN: "cid:csecret",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockResolvedValue(CFG);
});

describe("resolveLeadsTarget", () => {
  it("null when no service token; combined-token split; bare secret + client id", async () => {
    mockGetConfig.mockResolvedValue({});
    expect(await resolveLeadsTarget()).toBeNull();

    mockGetConfig.mockResolvedValue(CFG);
    const t = await resolveLeadsTarget();
    expect(t?.creds).toEqual({ clientId: "cid", clientSecret: "csecret" });
    expect(t?.url).toBe("https://social.cloudless.gr/api/v1/leads/public");

    mockGetConfig.mockResolvedValue({
      SOCIALAUTO_SERVICE_TOKEN: "bare-secret",
      SOCIALAUTO_CF_ACCESS_CLIENT_ID: "cid2",
      SOCIALAUTO_API_URL: "https://sa.example/",
    });
    const t2 = await resolveLeadsTarget();
    expect(t2?.url).toBe("https://sa.example/api/v1/leads/public");
    expect(t2?.creds.clientSecret).toBe("bare-secret");

    mockGetConfig.mockResolvedValue({ ...CFG, SOCIALAUTO_LEADS_URL: "https://custom/leads" });
    expect((await resolveLeadsTarget())?.url).toBe("https://custom/leads");
  });
});

describe("forwardPlaybookLead", () => {
  const post = () => forwardPlaybookLead(input);

  it("not_configured without a token", async () => {
    mockGetConfig.mockResolvedValue({});
    expect(await post()).toEqual({ ok: false, reason: "not_configured" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("success returns delivery + playbook URL; CF Access headers sent", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, playbook_delivery: "already_sent", playbook_url: "https://x/p.pdf" }), { status: 200 })
    );
    const r = await post();
    expect(r).toEqual({ ok: true, delivery: "already_sent", playbookUrl: "https://x/p.pdf" });
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Cf-Access-Client-Id"]).toBe("cid");
    expect(headers["Cf-Access-Client-Secret"]).toBe("csecret");
    expect(mockFetch.mock.calls[0][1].redirect).toBe("manual");
  });

  it("unknown delivery + missing URL → defaults", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, playbook_delivery: "weird", playbook_url: null }), { status: 200 })
    );
    const r = await post();
    expect(r).toEqual({ ok: true, delivery: "email", playbookUrl: PUBLIC_PLAYBOOK_URL });
  });

  it("3xx to a non-Access URL is not treated as an Access bounce", async () => {
    // covers isAccessRedirect's pathname fallback — plain external redirect → upstream_error
    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://login.example.com/x" } })
    );
    const r = await post();
    expect(r).toEqual({ ok: false, reason: "upstream_error", status: 302 });
  });

  it("3xx to /cdn-cgi/access/ path on any host → access_denied", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://social.cloudless.gr/cdn-cgi/access/login" },
      })
    );
    const r = await post();
    expect(r).toEqual({ ok: false, reason: "access_denied", status: 302 });
  });

  it("Access redirect (3xx to cloudflareaccess) → access_denied", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("", { status: 302, headers: { location: "https://x.cloudflareaccess.com/cdn-cgi/access/" } })
    );
    expect(await post()).toEqual({ ok: false, reason: "access_denied", status: 302 });
  });

  it("401/403 → access_denied; 400/422 → rejected; 5xx → upstream_error", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 401 }));
    expect(await post()).toEqual({ ok: false, reason: "access_denied", status: 401 });
    mockFetch.mockResolvedValueOnce(new Response("", { status: 422 }));
    expect(await post()).toEqual({ ok: false, reason: "rejected", status: 422 });
    mockFetch.mockResolvedValueOnce(new Response("", { status: 500 }));
    expect(await post()).toEqual({ ok: false, reason: "upstream_error", status: 500 });
  });

  it("200 HTML (Access interstitial) and ok:false bodies → upstream_error", async () => {
    mockFetch.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    expect(await post()).toEqual({ ok: false, reason: "upstream_error", status: 200 });
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 200 }));
    expect(await post()).toEqual({ ok: false, reason: "upstream_error", status: 200 });
  });

  it("fetch throw → upstream_error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    expect(await post()).toEqual({ ok: false, reason: "upstream_error" });
  });
});
