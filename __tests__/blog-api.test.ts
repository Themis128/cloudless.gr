import { beforeEach, describe, expect, it, vi } from "vitest";

const isConfiguredMock = vi.fn();
const getPostsMock = vi.fn();
const getPostBySlugMock = vi.fn();

vi.mock("@/lib/integrations", () => ({
  isConfigured: isConfiguredMock,
}));

vi.mock("@/lib/notion-blog", () => ({
  getPosts: getPostsMock,
  getPostBySlug: getPostBySlugMock,
}));

vi.mock("@/lib/blog", () => ({
  posts: [
    {
      slug: "hello-world",
      title: "Hello World",
      excerpt: "static fallback post",
    },
  ],
}));

describe("Blog API Notion fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/blog/posts returns static posts when Notion is not configured", async () => {
    isConfiguredMock.mockReturnValue(false);
    const { GET } = await import("@/app/api/blog/posts/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("not-configured");
    expect(response.headers.get("x-blog-source")).toBe("static");
    expect(getPostsMock).not.toHaveBeenCalled();
  });

  it("GET /api/blog/posts returns Notion source metadata when upstream succeeds", async () => {
    isConfiguredMock.mockReturnValue(true);
    getPostsMock.mockResolvedValueOnce([{ slug: "from-notion" }]);

    const { GET } = await import("@/app/api/blog/posts/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe("notion");
    expect(data.fallbackReason).toBeUndefined();
    expect(response.headers.get("x-blog-source")).toBe("notion");
  });

  it("GET /api/blog/posts falls back to static when Notion fetch throws", async () => {
    isConfiguredMock.mockReturnValue(true);
    getPostsMock.mockRejectedValueOnce(new Error("notion down"));

    const { GET } = await import("@/app/api/blog/posts/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("notion-error");
    expect(response.headers.get("x-blog-source")).toBe("static");
  });

  it("GET /api/blog/[slug] falls back to static when Notion fetch throws", async () => {
    isConfiguredMock.mockReturnValue(true);
    getPostBySlugMock.mockRejectedValueOnce(new Error("notion timeout"));

    const { GET } = await import("@/app/api/blog/[slug]/route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ slug: "hello-world" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe("static");
    expect(data.post.slug).toBe("hello-world");
  });

  it("GET /api/blog/[slug] uses static fallback when Notion returns null", async () => {
    isConfiguredMock.mockReturnValue(true);
    getPostBySlugMock.mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/blog/[slug]/route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ slug: "hello-world" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe("static");
    expect(data.post.slug).toBe("hello-world");
  });
});
