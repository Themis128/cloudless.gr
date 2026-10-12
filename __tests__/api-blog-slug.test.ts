/**
 * GET /api/blog/[slug] — static fallback, AppFlowy hit/miss, error fallback.
 * Real route + real static posts; mocks only the AppFlowy boundary.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockConfigured = vi.fn();
const mockGetBySlug = vi.fn();
vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: (...a: unknown[]) => mockConfigured(...a),
}));
vi.mock("@/lib/blog-source", () => ({
  getBlogPostBySlug: (...a: unknown[]) => mockGetBySlug(...a),
}));

import { GET } from "@/app/api/blog/[slug]/route";

const STATIC_SLUG = "cloud-cost-optimization-guide";
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const req = () => new Request("http://localhost/api/blog/x");

describe("GET /api/blog/[slug]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serves the static post when AppFlowy is unconfigured", async () => {
    mockConfigured.mockResolvedValue(false);
    const res = await GET(req(), params(STATIC_SLUG));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.source).toBe("static");
    expect(data.post.slug).toBe(STATIC_SLUG);
  });

  it("404s a missing slug when AppFlowy is unconfigured", async () => {
    mockConfigured.mockResolvedValue(false);
    const res = await GET(req(), params("does-not-exist"));
    expect(res.status).toBe(404);
  });

  it("serves the AppFlowy post with cache headers when configured", async () => {
    mockConfigured.mockResolvedValue(true);
    mockGetBySlug.mockResolvedValue({ slug: "cms-post", title: "CMS" });
    const res = await GET(req(), params("cms-post"));
    const data = await res.json();
    expect(data.source).toBe("appflowy");
    expect(res.headers.get("x-blog-source")).toBe("appflowy");
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
  });

  it("falls back to the static post when AppFlowy has no match", async () => {
    mockConfigured.mockResolvedValue(true);
    mockGetBySlug.mockResolvedValue(null);
    const res = await GET(req(), params(STATIC_SLUG));
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(res.headers.get("x-blog-source")).toBe("static");
  });

  it("404s when AppFlowy has no match and no static fallback exists", async () => {
    mockConfigured.mockResolvedValue(true);
    mockGetBySlug.mockResolvedValue(null);
    const res = await GET(req(), params("ghost-post"));
    expect(res.status).toBe(404);
  });

  it("falls back to static when the AppFlowy lookup throws", async () => {
    mockConfigured.mockResolvedValue(true);
    mockGetBySlug.mockRejectedValue(new Error("cms down"));
    const res = await GET(req(), params(STATIC_SLUG));
    expect((await res.json()).source).toBe("static");

    mockGetBySlug.mockRejectedValue(new Error("cms down"));
    const res2 = await GET(req(), params("ghost-post"));
    expect(res2.status).toBe(404);
  });
});
