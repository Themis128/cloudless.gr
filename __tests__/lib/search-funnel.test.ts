import { describe, it, expect } from "vitest";
import {
  FUNNEL_EVENT_TYPES,
  isFunnelEventType,
  normalizeFunnelEvent,
  getFunnelD1Binding,
} from "@/lib/search-funnel";

describe("FUNNEL_EVENT_TYPES", () => {
  it("contains the expected event types", () => {
    expect(FUNNEL_EVENT_TYPES).toContain("search_query");
    expect(FUNNEL_EVENT_TYPES).toContain("search_result");
    expect(FUNNEL_EVENT_TYPES).toContain("search_click");
    expect(FUNNEL_EVENT_TYPES).toContain("search_buy");
    expect(FUNNEL_EVENT_TYPES).toContain("rec_impression");
    expect(FUNNEL_EVENT_TYPES).toContain("rec_click");
  });
});

describe("isFunnelEventType", () => {
  it("returns true for valid event types", () => {
    for (const t of FUNNEL_EVENT_TYPES) {
      expect(isFunnelEventType(t)).toBe(true);
    }
  });

  it("returns false for unknown types", () => {
    expect(isFunnelEventType("page_view")).toBe(false);
    expect(isFunnelEventType("")).toBe(false);
  });
});

describe("normalizeFunnelEvent", () => {
  it("returns null for invalid event_type", () => {
    expect(normalizeFunnelEvent({ event_type: "bad", session_id: "s1" })).toBeNull();
  });

  it("returns null when session_id is missing", () => {
    expect(normalizeFunnelEvent({ event_type: "search_query", session_id: "" })).toBeNull();
  });

  it("normalizes a valid event", () => {
    const result = normalizeFunnelEvent({
      event_type: "search_query",
      session_id: "sess-abc",
      query: "cloud hosting",
      result_count: 5,
    });
    expect(result).not.toBeNull();
    expect(result?.event_type).toBe("search_query");
    expect(result?.session_id).toBe("sess-abc");
    expect(result?.query).toBe("cloud hosting");
    expect(result?.result_count).toBe(5);
  });

  it("trims query and session_id", () => {
    const result = normalizeFunnelEvent({
      event_type: "search_query",
      session_id: "  sess-123  ",
      query: "  cloud  ",
    });
    expect(result?.session_id).toBe("sess-123");
    expect(result?.query).toBe("cloud");
  });

  it("filters result_ids to strings and limits to 40", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `prod-${i}`);
    const result = normalizeFunnelEvent({
      event_type: "rec_impression",
      session_id: "s",
      result_ids: ids,
    });
    expect(result?.result_ids?.length).toBe(40);
  });

  it("ignores non-string result_ids", () => {
    const result = normalizeFunnelEvent({
      event_type: "rec_impression",
      session_id: "s",
      result_ids: ["prod-1", 42 as unknown as string, null as unknown as string],
    });
    expect(result?.result_ids).toEqual(["prod-1"]);
  });
});

describe("getFunnelD1Binding", () => {
  it("returns null in test environment (no D1 binding)", () => {
    expect(getFunnelD1Binding()).toBeNull();
  });
});
