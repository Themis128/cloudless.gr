/**
 * Unit tests for POST /api/track
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockTrackEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/analytics", () => ({
  trackAnalyticsEvent: (...a: unknown[]) => mockTrackEvent(...a),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/track", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 202 for valid page_view event", async () => {
    const { POST } = await import("@/app/api/track/route");
    const res = await POST(makeRequest({ type: "page_view", page: "/en" }));
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("returns 202 for blog_view event", async () => {
    const { POST } = await import("@/app/api/track/route");
    const res = await POST(makeRequest({ type: "blog_view", page: "/en/blog/post" }));
    expect(res.status).toBe(202);
  });

  it("returns 202 for doc_view event", async () => {
    const { POST } = await import("@/app/api/track/route");
    const res = await POST(makeRequest({ type: "doc_view", page: "/en/docs/intro" }));
    expect(res.status).toBe(202);
  });

  it("returns 202 for form_submit event", async () => {
    const { POST } = await import("@/app/api/track/route");
    const res = await POST(makeRequest({ type: "form_submit", page: "/en/contact" }));
    expect(res.status).toBe(202);
  });

  it("returns 400 for unsupported event type", async () => {
    const { POST } = await import("@/app/api/track/route");
    const res = await POST(makeRequest({ type: "unknown_event" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("@/app/api/track/route");
    const req = new NextRequest("http://localhost/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("fires-and-forgets — does not wait for trackEvent to resolve", async () => {
    let resolved = false;
    mockTrackEvent.mockImplementation(
      () =>
        new Promise((r) =>
          setTimeout(() => {
            resolved = true;
            r(undefined);
          }, 100)
        )
    );
    const { POST } = await import("@/app/api/track/route");
    await POST(makeRequest({ type: "page_view", page: "/" }));
    expect(resolved).toBe(false);
  });

  it("forwards session_id and utm fields to trackAnalyticsEvent", async () => {
    const { POST } = await import("@/app/api/track/route");
    const res = await POST(
      makeRequest({
        type: "page_view",
        page: "/en/store",
        session_id: "fs_abc123",
        utm_source: "linkedin",
        utm_medium: "paid",
        utm_campaign: "cloudless-boost",
      })
    );
    expect(res.status).toBe(202);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "page_view",
        session_id: "fs_abc123",
        source: "linkedin",
        medium: "paid",
        campaign: "cloudless-boost",
        page: "/en/store",
      })
    );
  });

  it("truncates oversized session_id and utm values", async () => {
    const { POST } = await import("@/app/api/track/route");
    const res = await POST(
      makeRequest({
        type: "page_view",
        session_id: "x".repeat(500),
        utm_source: "s".repeat(300),
      })
    );
    expect(res.status).toBe(202);
    const arg = mockTrackEvent.mock.calls.at(-1)?.[0];
    expect(arg.session_id).toHaveLength(128);
    expect(arg.source).toHaveLength(128);
  });

  it("returns 429 when rate limited", async () => {
    vi.doMock("@/lib/rate-limit", () => ({
      rateLimit: () => ({
        ok: false,
        response: new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }),
      }),
      getClientIp: () => "1.2.3.4",
    }));
    const { POST } = await import("@/app/api/track/route");
    const res = await POST(makeRequest({ type: "page_view" }));
    expect(res.status).toBe(429);
  });
});
