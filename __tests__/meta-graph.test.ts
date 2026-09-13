import { describe, expect, it } from "vitest";
import {
  META_GRAPH_API_VERSION,
  formatMetaDisableReason,
  metaGraphUrl,
  normalizeMetaAdAccountId,
} from "@/lib/meta-graph";

describe("meta-graph", () => {
  it("pins the current Marketing / Graph API version", () => {
    expect(META_GRAPH_API_VERSION).toBe("v26.0");
  });

  it("normalizes act_ prefixes without doubling", () => {
    expect(normalizeMetaAdAccountId("123")).toBe("act_123");
    expect(normalizeMetaAdAccountId("act_123")).toBe("act_123");
  });

  it("builds versioned Graph URLs", () => {
    expect(metaGraphUrl("/act_1/campaigns")).toBe(
      "https://graph.facebook.com/v26.0/act_1/campaigns"
    );
  });

  it("labels known disable_reason codes", () => {
    expect(formatMetaDisableReason(1)).toBe("ADS_INTEGRITY_POLICY");
    expect(formatMetaDisableReason(99)).toBe("code_99");
  });
});
