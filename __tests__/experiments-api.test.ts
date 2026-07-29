import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_FLAGS } from "@/lib/ab-flags";

vi.mock("@/lib/ab-flags", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ab-flags")>("@/lib/ab-flags");
  return {
    ...actual,
    getABFlags: vi.fn(async () => actual.DEFAULT_FLAGS),
  };
});

describe("GET /api/experiments/[flagId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for unknown flag", async () => {
    const { GET } = await import("@/app/api/experiments/[flagId]/route");
    const res = await GET(new NextRequest("http://localhost/api/experiments/nope"), {
      params: Promise.resolve({ flagId: "nope" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns store-recommendations variant a when flag disabled", async () => {
    const { GET } = await import("@/app/api/experiments/[flagId]/route");
    const res = await GET(
      new NextRequest("http://localhost/api/experiments/store-recommendations"),
      { params: Promise.resolve({ flagId: "store-recommendations" }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("store-recommendations");
    expect(data.enabled).toBe(false);
    expect(data.variant).toBe("a");
    expect(DEFAULT_FLAGS.some((f) => f.id === "store-recommendations")).toBe(true);
  });

  it("honors existing ab_ cookie", async () => {
    const { getABFlags } = await import("@/lib/ab-flags");
    vi.mocked(getABFlags).mockResolvedValueOnce([
      {
        id: "store-recommendations",
        name: "Store Recommendations",
        description: "test",
        enabled: true,
        trafficSplit: 100,
        variants: { a: "show", b: "hide" },
      },
    ]);

    const { GET } = await import("@/app/api/experiments/[flagId]/route");
    const res = await GET(
      new NextRequest("http://localhost/api/experiments/store-recommendations", {
        headers: { Cookie: "ab_store-recommendations=b" },
      }),
      { params: Promise.resolve({ flagId: "store-recommendations" }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(true);
    expect(data.variant).toBe("b");
  });
});
