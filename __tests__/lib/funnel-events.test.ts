import { describe, expect, it } from "vitest";

import {
  FUNNEL_EVENT_TYPES,
  isFunnelEventType,
} from "@/lib/funnel-events";

describe("funnel-events taxonomy", () => {
  it("exposes the full search/rec event list", () => {
    expect(FUNNEL_EVENT_TYPES).toEqual([
      "search_query",
      "search_result",
      "search_click",
      "search_buy",
      "rec_impression",
      "rec_click",
    ]);
  });

  it("accepts known event types and rejects unknown ones", () => {
    for (const t of FUNNEL_EVENT_TYPES) expect(isFunnelEventType(t)).toBe(true);
    expect(isFunnelEventType("page_view")).toBe(false);
    expect(isFunnelEventType("")).toBe(false);
  });
});
