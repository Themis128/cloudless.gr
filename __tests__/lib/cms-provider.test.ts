import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockReturnValue(false),
}));

import {
  isAppFlowyCmsConfigured,
  cmsSourceHeaders,
  blogSourceHeaders,
  type CmsSource,
} from "@/lib/cms-provider";

describe("isAppFlowyCmsConfigured", () => {
  it("delegates to isAppFlowyConfigured", async () => {
    const result = await isAppFlowyCmsConfigured();
    expect(typeof result).toBe("boolean");
  });
});

describe("cmsSourceHeaders", () => {
  it("returns header with appflowy source", () => {
    const headers = cmsSourceHeaders("appflowy") as Record<string, string>;
    expect(headers["x-cms-source"]).toBe("appflowy");
  });

  it("returns header with static source", () => {
    const headers = cmsSourceHeaders("static") as Record<string, string>;
    expect(headers["x-cms-source"]).toBe("static");
  });

  it("returns header with r2 source", () => {
    const headers = cmsSourceHeaders("r2") as Record<string, string>;
    expect(headers["x-cms-source"]).toBe("r2");
  });
});

describe("blogSourceHeaders", () => {
  it("returns x-blog-source header", () => {
    const headers = blogSourceHeaders("appflowy") as Record<string, string>;
    expect(headers["x-blog-source"]).toBe("appflowy");
  });
});
