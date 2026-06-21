/**
 * Unit tests for the CMS API routes:
 *   GET /api/services
 *   GET /api/faqs
 *   GET /api/testimonials
 *   GET /api/case-studies
 *   GET /api/case-studies/[slug]
 *   GET /api/docs
 *   GET /api/docs/[slug]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── shared mocks ─────────────────────────────────────────────────────────────

const mockIsConfiguredAsync = vi.fn();
const mockIsConfigured = vi.fn();

vi.mock("@/lib/integrations", () => ({
  isConfiguredAsync: (...args: unknown[]) => mockIsConfiguredAsync(...args),
  isConfigured: (...args: unknown[]) => mockIsConfigured(...args),
}));

// ── /api/services ─────────────────────────────────────────────────────────────

const mockGetServices = vi.fn();
vi.mock("@/lib/notion-services", () => ({
  getServices: (...a: unknown[]) => mockGetServices(...a),
  staticServices: [
    { id: "s1", title: "Web Dev", category: "Development", description: "", featured: true },
    { id: "s2", title: "SEO", category: "Marketing", description: "", featured: false },
  ],
}));

describe("GET /api/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns static fallback when not configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/services/route");
    const res = await GET(new Request("http://localhost/api/services"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("not-configured");
    expect(Array.isArray(data.services)).toBe(true);
  });

  it("filters static services by category", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/services/route");
    const res = await GET(new Request("http://localhost/api/services?category=Marketing"));
    const data = await res.json();
    expect(data.services.every((s: { category: string }) => s.category === "Marketing")).toBe(true);
  });

  it("returns notion data when configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetServices.mockResolvedValue([
      { id: "s3", title: "Cloud", category: "Dev", description: "", featured: true },
    ]);
    const { GET } = await import("@/app/api/services/route");
    const res = await GET(new Request("http://localhost/api/services"));
    const data = await res.json();
    expect(data.source).toBe("notion");
    expect(data.services).toHaveLength(1);
  });

  it("falls back to static on notion error", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetServices.mockRejectedValue(new Error("API error"));
    const { GET } = await import("@/app/api/services/route");
    const res = await GET(new Request("http://localhost/api/services"));
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("notion-error");
  });
});

// ── /api/faqs ─────────────────────────────────────────────────────────────────

const mockGetFaqs = vi.fn();
const mockGetFaqsByCategory = vi.fn();
vi.mock("@/lib/notion-faqs", () => ({
  getFaqs: (...a: unknown[]) => mockGetFaqs(...a),
  getFaqsByCategory: (...a: unknown[]) => mockGetFaqsByCategory(...a),
  staticFaqs: [
    { id: "f1", question: "Q1", answer: "A1", category: "General", locales: [] },
    { id: "f2", question: "Q2", answer: "A2", category: "Billing", locales: ["en"] },
  ],
}));

describe("GET /api/faqs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns static fallback when not configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/faqs/route");
    const res = await GET(new Request("http://localhost/api/faqs"));
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("not-configured");
  });

  it("filters static faqs by category", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/faqs/route");
    const res = await GET(new Request("http://localhost/api/faqs?category=Billing"));
    const data = await res.json();
    expect(data.faqs.every((f: { category: string }) => f.category === "Billing")).toBe(true);
  });

  it("returns notion data when configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetFaqs.mockResolvedValue([{ id: "f3", question: "Q3", answer: "A3" }]);
    const { GET } = await import("@/app/api/faqs/route");
    const res = await GET(new Request("http://localhost/api/faqs"));
    const data = await res.json();
    expect(data.source).toBe("notion");
  });

  it("uses getFaqsByCategory when category param given and configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetFaqsByCategory.mockResolvedValue([]);
    const { GET } = await import("@/app/api/faqs/route");
    await GET(new Request("http://localhost/api/faqs?category=General"));
    expect(mockGetFaqsByCategory).toHaveBeenCalledWith("General", undefined);
  });
});

// ── /api/testimonials ─────────────────────────────────────────────────────────

const mockGetTestimonials = vi.fn();
const mockGetFeaturedTestimonials = vi.fn();
vi.mock("@/lib/notion-testimonials", () => ({
  getTestimonials: (...a: unknown[]) => mockGetTestimonials(...a),
  getFeaturedTestimonials: (...a: unknown[]) => mockGetFeaturedTestimonials(...a),
  staticTestimonials: [
    { id: "t1", name: "Alice", text: "Great!", featured: true },
    { id: "t2", name: "Bob", text: "Good", featured: false },
  ],
}));

describe("GET /api/testimonials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns static fallback when not configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/testimonials/route");
    const res = await GET(new Request("http://localhost/api/testimonials"));
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.testimonials).toHaveLength(2);
  });

  it("filters static to featured when ?featured=true and not configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/testimonials/route");
    const res = await GET(new Request("http://localhost/api/testimonials?featured=true"));
    const data = await res.json();
    expect(data.testimonials.every((t: { featured: boolean }) => t.featured)).toBe(true);
  });

  it("returns notion data when configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetTestimonials.mockResolvedValue([]);
    const { GET } = await import("@/app/api/testimonials/route");
    const res = await GET(new Request("http://localhost/api/testimonials"));
    const data = await res.json();
    expect(data.source).toBe("notion");
  });

  it("calls getFeaturedTestimonials when ?featured=true and configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetFeaturedTestimonials.mockResolvedValue([]);
    const { GET } = await import("@/app/api/testimonials/route");
    await GET(new Request("http://localhost/api/testimonials?featured=true"));
    expect(mockGetFeaturedTestimonials).toHaveBeenCalled();
  });
});

// ── /api/case-studies ─────────────────────────────────────────────────────────

const mockGetCaseStudies = vi.fn();
const mockGetFeaturedCaseStudies = vi.fn();
const mockGetCaseStudyBySlug = vi.fn();
vi.mock("@/lib/notion-case-studies", () => ({
  getCaseStudies: (...a: unknown[]) => mockGetCaseStudies(...a),
  getFeaturedCaseStudies: (...a: unknown[]) => mockGetFeaturedCaseStudies(...a),
  getCaseStudyBySlug: (...a: unknown[]) => mockGetCaseStudyBySlug(...a),
  staticCaseStudies: [
    { id: "cs1", slug: "sample", title: "Case 1", featured: true },
    { id: "cs2", slug: "other", title: "Case 2", featured: false },
  ],
}));

describe("GET /api/case-studies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns static fallback when not configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/case-studies/route");
    const res = await GET(new Request("http://localhost/api/case-studies"));
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.caseStudies).toHaveLength(2);
  });

  it("returns notion data when configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetCaseStudies.mockResolvedValue([]);
    const { GET } = await import("@/app/api/case-studies/route");
    const res = await GET(new Request("http://localhost/api/case-studies"));
    const data = await res.json();
    expect(data.source).toBe("notion");
  });
});

describe("GET /api/case-studies/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns static case study when not configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://localhost/api/case-studies/sample"), {
      params: Promise.resolve({ slug: "sample" }),
    });
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.caseStudy.slug).toBe("sample");
  });

  it("returns 404 when static slug not found", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://localhost/api/case-studies/missing"), {
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns notion data when configured and found", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetCaseStudyBySlug.mockResolvedValue({
      id: "cs1",
      slug: "sample",
      title: "Case 1",
      html: "<p>body</p>",
    });
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://localhost/api/case-studies/sample"), {
      params: Promise.resolve({ slug: "sample" }),
    });
    const data = await res.json();
    expect(data.source).toBe("notion");
    expect(data.caseStudy.slug).toBe("sample");
  });

  it("returns 404 when notion returns null", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetCaseStudyBySlug.mockResolvedValue(null);
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://localhost/api/case-studies/gone"), {
      params: Promise.resolve({ slug: "gone" }),
    });
    expect(res.status).toBe(404);
  });
});

// ── /api/docs ─────────────────────────────────────────────────────────────────

const mockGetDocs = vi.fn();
const mockGroupDocsByCategory = vi.fn();
const mockGetDocBySlug = vi.fn();
const mockGetDocContent = vi.fn();

vi.mock("@/lib/notion-docs", () => ({
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  groupDocsByCategory: (...a: unknown[]) => mockGroupDocsByCategory(...a),
  getDocBySlug: (...a: unknown[]) => mockGetDocBySlug(...a),
  getDocContent: (...a: unknown[]) => mockGetDocContent(...a),
}));

describe("GET /api/docs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns empty docs when not configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/docs/route");
    const res = await GET();
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.docs).toEqual([]);
  });

  it("returns docs from notion when configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetDocs.mockResolvedValue([{ id: "d1", slug: "intro", title: "Intro" }]);
    mockGroupDocsByCategory.mockReturnValue({ General: [{ id: "d1" }] });
    const { GET } = await import("@/app/api/docs/route");
    const res = await GET();
    const data = await res.json();
    expect(data.source).toBe("notion");
    expect(data.docs).toHaveLength(1);
    expect(data.grouped).toBeDefined();
  });

  it("falls back to empty on notion error", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetDocs.mockRejectedValue(new Error("API down"));
    const { GET } = await import("@/app/api/docs/route");
    const res = await GET();
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("notion-error");
  });
});

describe("GET /api/docs/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 503 when not configured", async () => {
    mockIsConfigured.mockReturnValue(false);
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/docs/[slug]/route");
    const res = await GET(new NextRequest("http://localhost/api/docs/intro"), {
      params: Promise.resolve({ slug: "intro" }),
    });
    expect(res.status).toBe(503);
  });

  it("returns 404 when doc not found", async () => {
    mockIsConfigured.mockReturnValue(true);
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetDocBySlug.mockResolvedValue(null);
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/docs/[slug]/route");
    const res = await GET(new NextRequest("http://localhost/api/docs/missing"), {
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 500 when content fetch fails", async () => {
    mockIsConfigured.mockReturnValue(true);
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetDocBySlug.mockResolvedValue({ id: "d1", slug: "intro" });
    mockGetDocContent.mockResolvedValue(null);
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/docs/[slug]/route");
    const res = await GET(new NextRequest("http://localhost/api/docs/intro"), {
      params: Promise.resolve({ slug: "intro" }),
    });
    expect(res.status).toBe(500);
  });

  it("returns doc content when found", async () => {
    mockIsConfigured.mockReturnValue(true);
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetDocBySlug.mockResolvedValue({ id: "d1", slug: "intro", title: "Intro" });
    mockGetDocContent.mockResolvedValue({
      id: "d1",
      slug: "intro",
      title: "Intro",
      html: "<p>content</p>",
    });
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/docs/[slug]/route");
    const res = await GET(new NextRequest("http://localhost/api/docs/intro"), {
      params: Promise.resolve({ slug: "intro" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.html).toBe("<p>content</p>");
  });
});
