import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FUNNEL_EVENT_TYPES,
  isFunnelEventType,
  normalizeFunnelEvent,
  recordFunnelEvent,
  getFunnelSummary,
} from "@/lib/search-funnel";

describe("search-funnel helpers", () => {
  it("lists expected funnel event types", () => {
    expect(FUNNEL_EVENT_TYPES).toContain("search_query");
    expect(FUNNEL_EVENT_TYPES).toContain("search_result");
    expect(FUNNEL_EVENT_TYPES).toContain("search_click");
    expect(FUNNEL_EVENT_TYPES).toContain("rec_impression");
    expect(FUNNEL_EVENT_TYPES).toContain("rec_click");
  });

  it("isFunnelEventType guards known events", () => {
    expect(isFunnelEventType("search_query")).toBe(true);
    expect(isFunnelEventType("page_view")).toBe(false);
  });

  it("normalizeFunnelEvent requires session_id + valid type", () => {
    expect(normalizeFunnelEvent({ event_type: "search_query" })).toBeNull();
    expect(
      normalizeFunnelEvent({ event_type: "nope", session_id: "s1" } as { event_type: string; session_id: string })
    ).toBeNull();

    const ok = normalizeFunnelEvent({
      event_type: "search_result",
      session_id: "  sid-1  ",
      query: "audit",
      result_ids: ["srv-cloud", 42 as unknown as string, "dig-cloud-playbook"],
      source: "fallback",
    });
    expect(ok).toEqual({
      event_type: "search_result",
      session_id: "sid-1",
      query: "audit",
      result_ids: ["srv-cloud", "dig-cloud-playbook"],
      product_id: undefined,
      source: "fallback",
      result_count: 2,
      ab_variant: undefined,
      user_id: undefined,
    });
  });

  it("recordFunnelEvent no-ops without D1 binding", async () => {
    const written = await recordFunnelEvent({
      event_type: "search_query",
      session_id: "sid",
      query: "x",
    });
    expect(written).toBe(false);
  });

  it("getFunnelSummary returns null without D1", async () => {
    expect(await getFunnelSummary(7)).toBeNull();
  });

  it("recordFunnelEvent writes via mocked D1 prepare/bind/run", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    (globalThis as unknown as { __AUTH_DB__: { prepare: typeof prepare } }).__AUTH_DB__ = {
      prepare,
    };

    try {
      const written = await recordFunnelEvent({
        event_type: "rec_impression",
        session_id: "sid-ab",
        ab_variant: "a",
        source: "trending",
      });
      expect(written).toBe(true);
      expect(prepare).toHaveBeenCalledOnce();
      expect(bind).toHaveBeenCalled();
      expect(run).toHaveBeenCalledOnce();
    } finally {
      delete (globalThis as unknown as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    }
  });
});

describe("POST /api/analytics/track funnel → D1", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("silent no-op without analytics consent", async () => {
    const { POST } = await import("@/app/api/analytics/track/route");
    const { NextRequest } = await import("next/server");
    const res = await POST(
      new NextRequest("http://localhost/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "search_query",
          session_id: "s1",
          properties: { query: "audit" },
        }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("writes funnel events to D1 when consented", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    (globalThis as unknown as { __AUTH_DB__: { prepare: typeof prepare } }).__AUTH_DB__ = {
      prepare,
    };

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(null),
    }));

    try {
      const { POST } = await import("@/app/api/analytics/track/route");
      const { NextRequest } = await import("next/server");
      const consent = encodeURIComponent(JSON.stringify({ analytics: true }));
      const res = await POST(
        new NextRequest("http://localhost/api/analytics/track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `cookieConsent=${consent}`,
          },
          body: JSON.stringify({
            event: "search_result",
            session_id: "s-consent",
            properties: {
              query: "serverless",
              result_ids: ["srv-serverless"],
              source: "fallback",
            },
          }),
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.sink).toBe("d1-funnel");
      expect(prepare).toHaveBeenCalled();
    } finally {
      delete (globalThis as unknown as { __AUTH_DB__?: unknown }).__AUTH_DB__;
      vi.doUnmock("@/lib/auth");
    }
  });

  it("writes generic events to analytics_events D1 table when consented", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    (globalThis as unknown as { __AUTH_DB__: { prepare: typeof prepare } }).__AUTH_DB__ = {
      prepare,
    };

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(null),
    }));

    try {
      const { POST } = await import("@/app/api/analytics/track/route");
      const { NextRequest } = await import("next/server");
      const consent = encodeURIComponent(JSON.stringify({ analytics: true }));
      const res = await POST(
        new NextRequest("http://localhost/api/analytics/track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `cookieConsent=${consent}`,
          },
          body: JSON.stringify({
            event: "page_view",
            session_id: "s-page",
            page: "/en/store",
          }),
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.sink).toBe("d1");
      expect(prepare).toHaveBeenCalled();
      const sql = String(prepare.mock.calls[0]?.[0] ?? "");
      expect(sql).toContain("analytics_events");
    } finally {
      delete (globalThis as unknown as { __AUTH_DB__?: unknown }).__AUTH_DB__;
      vi.doUnmock("@/lib/auth");
    }
  });
});
