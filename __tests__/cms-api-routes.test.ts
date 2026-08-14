/**
 * Unit tests for CMS API routes under dual-run (#1361):
 *   GET /api/services
 *   GET /api/faqs
 *   GET /api/testimonials
 *   GET /api/case-studies
 *   GET /api/case-studies/[slug]
 *   GET /api/docs
 *   GET /api/docs/[slug]
 *
 * Expectations match current production shapes: wrapped objects for services/docs
 * (with source + fallbackReason), bare arrays + x-cms-source for faqs/testimonials/
 * case-studies list, and cms-error (not notion-error) on CMS failures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsAppFlowyCmsConfigured = vi.fn();
const mockIsAppFlowyConfigured = vi.fn();

vi.mock("@/lib/cms-provider", () => ({
  isAppFlowyCmsConfigured: (...a: unknown[]) => mockIsAppFlowyCmsConfigured(...a),
  cmsSourceHeaders: (source: string) => ({ "x-cms-source": source }),
}));

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: (...a: unknown[]) => mockIsAppFlowyConfigured(...a),
}));

vi.mock("@/lib/integrations", () => ({
  isConfiguredAsync: (...a: unknown[]) => mockIsConfiguredAsync(...a),
  isConfigured: vi.fn(),
}));

// ── /api/services ─────────────────────────────────────────────────────────────

const mockGetAppFlowyServices = vi.fn();
const STATIC_SERVICES = [
  { id: "s1", title: "Web Dev", category: "Development", description: "", featured: true },
  { id: "s2", title: "SEO", category: "Marketing", description: "", featured: false },
];

vi.mock("@/lib/appflowy-services", () => ({
  getServices: (...a: unknown[]) => mockGetAppFlowyServices(...a),
  staticServices: STATIC_SERVICES,
}));

describe("GET /api/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsAppFlowyCmsConfigured.mockResolvedValue(false);
  });

  it("returns static fallback when not configured", async () => {
    const { GET } = await import("@/app/api/services/route");
    const res = await GET(new Request("http://localhost/api/services"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("not-configured");
    expect(Array.isArray(data.services)).toBe(true);
    expect(res.headers.get("x-cms-source")).toBe("static");
  });

  it("filters static services by category", async () => {
    const { GET } = await import("@/app/api/services/route");
    const res = await GET(new Request("http://localhost/api/services?category=Marketing"));
    const data = await res.json();
    expect(data.services.every((s: { category: string }) => s.category === "Marketing")).toBe(true);
  });

  it("returns AppFlowy data when configured", async () => {
    mockIsAppFlowyCmsConfigured.mockResolvedValue(true);
    mockGetAppFlowyServices.mockResolvedValue([
      { id: "s3", title: "Cloud", category: "Dev", description: "", featured: true },
    ]);
    const { GET } = await import("@/app/api/services/route");
    const res = await GET(new Request("http://localhost/api/services"));
    const data = await res.json();
    expect(data.source).toBe("appflowy");
    expect(data.services).toHaveLength(1);
    expect(res.headers.get("x-cms-source")).toBe("appflowy");
  });

  it("falls back to static on cms error", async () => {
    mockIsAppFlowyCmsConfigured.mockResolvedValue(true);
    mockGetAppFlowyServices.mockRejectedValue(new Error("API error"));
    const { GET } = await import("@/app/api/services/route");
    const res = await GET(new Request("http://localhost/api/services"));
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("cms-error");
  });
});

// ── /api/faqs ─────────────────────────────────────────────────────────────────

const mockGetAppFlowyFaqs = vi.fn();
const mockGetAppFlowyFaqsByCategory = vi.fn();
const mockGetNotionFaqs = vi.fn();
const mockGetNotionFaqsByCategory = vi.fn();
const STATIC_FAQS = [
  { id: "f1", question: "Q1", answer: "A1", category: "General", locales: [] },
  { id: "f2", question: "Q2", answer: "A2", category: "Billing", locales: ["en"] },
];

vi.mock("@/lib/appflowy-faqs", () => ({
  getFaqs: (...a: unknown[]) => mockGetAppFlowyFaqs(...a),
  getFaqsByCategory: (...a: unknown[]) => mockGetAppFlowyFaqsByCategory(...a),
  staticFaqs: STATIC_FAQS,
}));

vi.mock("@/lib/notion-faqs", () => ({
  getFaqs: (...a: unknown[]) => mockGetNotionFaqs(...a),
  getFaqsByCategory: (...a: unknown[]) => mockGetNotionFaqsByCategory(...a),
  staticFaqs: STATIC_FAQS,
}));

describe("GET /api/faqs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsAppFlowyCmsConfigured.mockResolvedValue(false);
  });

  it("returns bare static array + x-cms-source when not configured", async () => {
    const { GET } = await import("@/app/api/faqs/route");
    const res = await GET(new Request("http://localhost/api/faqs"));
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(res.headers.get("x-cms-source")).toBe("static");
  });

  it("filters static faqs by category", async () => {
    const { GET } = await import("@/app/api/faqs/route");
    const res = await GET(new Request("http://localhost/api/faqs?category=Billing"));
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.every((f: { category: string }) => f.category === "Billing")).toBe(true);
  });

  it("returns bare notion array when Notion is configured", async () => {
    mockIsNotionCmsConfigured.mockResolvedValue(true);
    mockGetNotionFaqs.mockResolvedValue([{ id: "f3", question: "Q3", answer: "A3" }]);
    const { GET } = await import("@/app/api/faqs/route");
    const res = await GET(new Request("http://localhost/api/faqs"));
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(res.headers.get("x-cms-source")).toBe("notion");
  });

  it("uses Notion getFaqsByCategory when category param given and configured", async () => {
    mockIsNotionCmsConfigured.mockResolvedValue(true);
    mockGetNotionFaqsByCategory.mockResolvedValue([]);
    const { GET } = await import("@/app/api/faqs/route");
    await GET(new Request("http://localhost/api/faqs?category=General"));
    expect(mockGetNotionFaqsByCategory).toHaveBeenCalledWith("General", undefined);
  });
});

// ── /api/testimonials ─────────────────────────────────────────────────────────

const mockGetAppFlowyTestimonials = vi.fn();
const mockGetAppFlowyFeatured = vi.fn();
const mockGetNotionTestimonials = vi.fn();
const mockGetNotionFeatured = vi.fn();
const STATIC_TESTIMONIALS = [
  { id: "t1", name: "Alice", text: "Great!", featured: true },
  { id: "t2", name: "Bob", text: "Good", featured: false },
];

vi.mock("@/lib/appflowy-testimonials", () => ({
  getTestimonials: (...a: unknown[]) => mockGetAppFlowyTestimonials(...a),
  getFeaturedTestimonials: (...a: unknown[]) => mockGetAppFlowyFeatured(...a),
  staticTestimonials: STATIC_TESTIMONIALS,
}));

vi.mock("@/lib/notion-testimonials", () => ({
  getTestimonials: (...a: unknown[]) => mockGetNotionTestimonials(...a),
  getFeaturedTestimonials: (...a: unknown[]) => mockGetNotionFeatured(...a),
  staticTestimonials: STATIC_TESTIMONIALS,
}));

describe("GET /api/testimonials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsAppFlowyCmsConfigured.mockResolvedValue(false);
  });

  it("returns bare static array when not configured", async () => {
    const { GET } = await import("@/app/api/testimonials/route");
    const res = await GET(new Request("http://localhost/api/testimonials"));
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(res.headers.get("x-cms-source")).toBe("static");
  });

  it("filters static to featured when ?featured=true and not configured", async () => {
    const { GET } = await import("@/app/api/testimonials/route");
    const res = await GET(new Request("http://localhost/api/testimonials?featured=true"));
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.every((t: { featured: boolean }) => t.featured)).toBe(true);
  });

  it("returns bare notion array when Notion is configured", async () => {
    mockIsNotionCmsConfigured.mockResolvedValue(true);
    mockGetNotionTestimonials.mockResolvedValue([{ id: "t3", name: "Cara", featured: false }]);
    const { GET } = await import("@/app/api/testimonials/route");
    const res = await GET(new Request("http://localhost/api/testimonials"));
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(res.headers.get("x-cms-source")).toBe("notion");
  });

  it("calls Notion getFeaturedTestimonials when ?featured=true and configured", async () => {
    mockIsNotionCmsConfigured.mockResolvedValue(true);
    mockGetNotionFeatured.mockResolvedValue([]);
    const { GET } = await import("@/app/api/testimonials/route");
    await GET(new Request("http://localhost/api/testimonials?featured=true"));
    expect(mockGetNotionFeatured).toHaveBeenCalled();
  });
});

// ── /api/case-studies ─────────────────────────────────────────────────────────

const mockGetAppFlowyCaseStudies = vi.fn();
const mockGetAppFlowyFeaturedCs = vi.fn();
const mockGetAppFlowyCsBySlug = vi.fn();
const mockGetNotionCaseStudies = vi.fn();
const mockGetNotionFeaturedCs = vi.fn();
const mockGetNotionCsBySlug = vi.fn();
const STATIC_CASE_STUDIES = [
  { id: "cs1", slug: "sample", title: "Case 1", featured: true },
  { id: "cs2", slug: "other", title: "Case 2", featured: false },
];

vi.mock("@/lib/appflowy-case-studies", () => ({
  getCaseStudies: (...a: unknown[]) => mockGetAppFlowyCaseStudies(...a),
  getFeaturedCaseStudies: (...a: unknown[]) => mockGetAppFlowyFeaturedCs(...a),
  getCaseStudyBySlug: (...a: unknown[]) => mockGetAppFlowyCsBySlug(...a),
  staticCaseStudies: STATIC_CASE_STUDIES,
}));

vi.mock("@/lib/notion-case-studies", () => ({
  getCaseStudies: (...a: unknown[]) => mockGetNotionCaseStudies(...a),
  getFeaturedCaseStudies: (...a: unknown[]) => mockGetNotionFeaturedCs(...a),
  getCaseStudyBySlug: (...a: unknown[]) => mockGetNotionCsBySlug(...a),
  staticCaseStudies: STATIC_CASE_STUDIES,
}));

describe("GET /api/case-studies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsAppFlowyCmsConfigured.mockResolvedValue(false);
  });

  it("returns bare static array when not configured", async () => {
    const { GET } = await import("@/app/api/case-studies/route");
    const res = await GET(new Request("http://localhost/api/case-studies"));
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(res.headers.get("x-cms-source")).toBe("static");
  });

  it("returns bare notion array when Notion is configured", async () => {
    mockIsNotionCmsConfigured.mockResolvedValue(true);
    mockGetNotionCaseStudies.mockResolvedValue([{ id: "cs3", slug: "live", title: "Live" }]);
    const { GET } = await import("@/app/api/case-studies/route");
    const res = await GET(new Request("http://localhost/api/case-studies"));
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(res.headers.get("x-cms-source")).toBe("notion");
  });
});

describe("GET /api/case-studies/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsAppFlowyCmsConfigured.mockResolvedValue(false);
  });

  it("returns static case study when not configured", async () => {
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://localhost/api/case-studies/sample"), {
      params: Promise.resolve({ slug: "sample" }),
    });
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.caseStudy.slug).toBe("sample");
  });

  it("returns 404 when static slug not found", async () => {
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://localhost/api/case-studies/missing"), {
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns notion data when configured and found", async () => {
    mockIsNotionCmsConfigured.mockResolvedValue(true);
    mockGetNotionCsBySlug.mockResolvedValue({
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
    mockIsNotionCmsConfigured.mockResolvedValue(true);
    mockGetNotionCsBySlug.mockResolvedValue(null);
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://localhost/api/case-studies/gone"), {
      params: Promise.resolve({ slug: "gone" }),
    });
    expect(res.status).toBe(404);
  });
});

// ── /api/docs ─────────────────────────────────────────────────────────────────

const mockGetAppFlowyDocs = vi.fn();
const mockGroupAppFlowyDocs = vi.fn();
const mockGetNotionDocs = vi.fn();
const mockGroupNotionDocs = vi.fn();
const mockGetAppFlowyDocBySlug = vi.fn();
const mockGetAppFlowyDocContent = vi.fn();
const mockGetNotionDocBySlug = vi.fn();
const mockGetNotionDocContent = vi.fn();

vi.mock("@/lib/appflowy-docs", () => ({
  getDocs: (...a: unknown[]) => mockGetAppFlowyDocs(...a),
  groupDocsByCategory: (...a: unknown[]) => mockGroupAppFlowyDocs(...a),
  getDocBySlug: (...a: unknown[]) => mockGetAppFlowyDocBySlug(...a),
  getDocContentWithToc: (...a: unknown[]) => mockGetAppFlowyDocContent(...a),
}));

vi.mock("@/lib/notion-docs", () => ({
  getDocs: (...a: unknown[]) => mockGetNotionDocs(...a),
  groupDocsByCategory: (...a: unknown[]) => mockGroupNotionDocs(...a),
  getDocBySlug: (...a: unknown[]) => mockGetNotionDocBySlug(...a),
  getDocContent: (...a: unknown[]) => mockGetNotionDocContent(...a),
}));

describe("GET /api/docs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsAppFlowyConfigured.mockResolvedValue(false);
    mockIsConfiguredAsync.mockResolvedValue(false);
  });

  it("returns empty docs when not configured", async () => {
    const { GET } = await import("@/app/api/docs/route");
    const res = await GET();
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("not-configured");
    expect(data.docs).toEqual([]);
    expect(res.headers.get("x-cms-source")).toBe("static");
  });

  it("returns docs from notion when configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetNotionDocs.mockResolvedValue([{ id: "d1", slug: "intro", title: "Intro" }]);
    mockGroupNotionDocs.mockReturnValue({ General: [{ id: "d1" }] });
    const { GET } = await import("@/app/api/docs/route");
    const res = await GET();
    const data = await res.json();
    expect(data.source).toBe("notion");
    expect(data.docs).toHaveLength(1);
    expect(data.grouped).toBeDefined();
  });

  it("falls back to empty on cms error", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetNotionDocs.mockRejectedValue(new Error("API down"));
    const { GET } = await import("@/app/api/docs/route");
    const res = await GET();
    const data = await res.json();
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("cms-error");
  });
});

describe("GET /api/docs/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsAppFlowyConfigured.mockResolvedValue(false);
    mockIsConfiguredAsync.mockResolvedValue(false);
  });

  it("returns 503 when not configured", async () => {
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/docs/[slug]/route");
    const res = await GET(new NextRequest("http://localhost/api/docs/intro"), {
      params: Promise.resolve({ slug: "intro" }),
    });
    expect(res.status).toBe(503);
  });

  it("returns 404 when doc not found", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetNotionDocBySlug.mockResolvedValue(null);
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/docs/[slug]/route");
    const res = await GET(new NextRequest("http://localhost/api/docs/missing"), {
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 500 when content fetch fails", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetNotionDocBySlug.mockResolvedValue({ id: "d1", slug: "intro" });
    mockGetNotionDocContent.mockResolvedValue(null);
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/docs/[slug]/route");
    const res = await GET(new NextRequest("http://localhost/api/docs/intro"), {
      params: Promise.resolve({ slug: "intro" }),
    });
    expect(res.status).toBe(500);
  });

  it("returns doc content when found", async () => {
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetNotionDocBySlug.mockResolvedValue({ id: "d1", slug: "intro", title: "Intro" });
    mockGetNotionDocContent.mockResolvedValue({
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
