/**
 * Tests for AppFlowy CMS adapters:
 *   src/lib/appflowy-faqs.ts
 *   src/lib/appflowy-services.ts
 *   src/lib/appflowy-testimonials.ts
 *
 * All three share the same pattern:
 *   isAppFlowyConfigured() → listAllWorkspaces() → listAllViewsDeep() →
 *   getDocument() → extractDocText() → parse markdown fields → return items
 *
 * When not configured, faqs/services return [] and admin functions return static fallbacks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mocks so vi.mock() factory can reference them
// ---------------------------------------------------------------------------
const {
  mockIsConfigured,
  mockListWorkspaces,
  mockListViews,
  mockGetDocument,
  mockExtractDocText,
} = vi.hoisted(() => ({
  mockIsConfigured: vi.fn(),
  mockListWorkspaces: vi.fn(),
  mockListViews: vi.fn(),
  mockGetDocument: vi.fn(),
  mockExtractDocText: vi.fn(),
}));

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: mockIsConfigured,
  listAllWorkspaces: mockListWorkspaces,
  listAllViewsDeep: mockListViews,
  getDocument: mockGetDocument,
  extractDocText: mockExtractDocText,
}));

vi.mock("@/lib/cms-static", () => ({
  staticFaqs: [
    {
      id: "sf-1",
      question: "What is the minimum engagement?",
      answer: "€1,500 for a Cloud Audit.",
      category: "pricing",
      locales: [],
    },
  ],
  staticServices: [
    {
      id: "ss-1",
      slug: "cloud-audit",
      name: "Cloud Audit",
      description: "Comprehensive AWS audit.",
      price: "From €1,500",
      category: "audit",
      features: ["Security review", "Cost optimisation"],
      cta: "Book an audit",
      icon: "🔍",
    },
  ],
  staticTestimonials: [
    {
      id: "st-1",
      name: "Jane Doe",
      company: "Acme",
      role: "CTO",
      quote: "Excellent service!",
      rating: 5,
      featured: true,
    },
  ],
}));

// Import AFTER mocks are in place
import {
  getFaqs,
  getFaqsByCategory,
  getAllFaqsAdmin,
} from "@/lib/appflowy-faqs";
import { getServices } from "@/lib/appflowy-services";
import {
  getTestimonials,
  getFeaturedTestimonials,
  getAllTestimonialsAdmin,
} from "@/lib/appflowy-testimonials";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const WORKSPACE_ID = "ws-abc-123";

function makeWorkspace() {
  return [{ workspace_id: WORKSPACE_ID, name: "Cloudless" }];
}

function makeView(name: string, viewId?: string) {
  return {
    name,
    view_id: viewId ?? `view-${name.replace(/\s+/g, "-").toLowerCase()}`,
    last_edited_time: "2025-01-15T10:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Reset all mocks before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  mockIsConfigured.mockReset();
  mockListWorkspaces.mockReset();
  mockListViews.mockReset();
  mockGetDocument.mockReset();
  mockExtractDocText.mockReset();
});

// ===========================================================================
// appflowy-faqs.ts — getFaqs()
// ===========================================================================
describe("getFaqs()", () => {
  it("returns [] when AppFlowy is not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    const result = await getFaqs();
    expect(result).toEqual([]);
    expect(mockListWorkspaces).not.toHaveBeenCalled();
  });

  it("returns [] when workspace list is empty", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue([]);
    const result = await getFaqs();
    expect(result).toEqual([]);
    expect(mockListViews).not.toHaveBeenCalled();
  });

  it("returns [] when no views match [FAQ] prefix", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([
      makeView("General Notes"),
      makeView("[Service] Cloud Audit"),
      makeView("[Testimonial] Jane"),
    ]);
    const result = await getFaqs();
    expect(result).toEqual([]);
  });

  it("skips views not published (Published: false)", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[FAQ] How does pricing work?", "view-faq-1")]);
    mockGetDocument.mockResolvedValue({ doc: "test" });
    mockExtractDocText.mockResolvedValue(
      "**Answer**: From €1,500\n**Category**: pricing\n**Published**: false\n**Locale**: en"
    );
    const result = await getFaqs();
    expect(result).toEqual([]);
  });

  it("returns published FAQ with parsed fields", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[FAQ] How does pricing work?", "view-faq-1")]);
    mockGetDocument.mockResolvedValue({ doc: "test" });
    mockExtractDocText.mockResolvedValue(
      "**Answer**: From €1,500\n**Category**: pricing\n**Published**: true\n**Locale**: en\n**Order**: 1"
    );
    const result = await getFaqs();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "view-faq-1",
      question: "How does pricing work?",
      answer: "From €1,500",
      category: "pricing",
      locales: ["en"],
      published: true,
      order: 1,
    });
  });

  it("strips [FAQ] prefix from question", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[FAQ] What is cloud computing?", "view-faq-2")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Published**: true");
    const result = await getFaqs();
    expect(result[0].question).toBe("What is cloud computing?");
  });

  it("filters by locale when locale is provided", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([
      makeView("[FAQ] English only FAQ", "view-faq-en"),
      makeView("[FAQ] Greek only FAQ", "view-faq-el"),
    ]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText
      .mockResolvedValueOnce("**Published**: true\n**Locale**: en")
      .mockResolvedValueOnce("**Published**: true\n**Locale**: el");
    const result = await getFaqs("el");
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe("Greek only FAQ");
  });

  it("includes FAQ with no locales set regardless of locale filter", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[FAQ] Universal FAQ", "view-faq-u")]);
    mockGetDocument.mockResolvedValue({});
    // No Locale field → locales = [] → included for any locale
    mockExtractDocText.mockResolvedValue("**Published**: true");
    const result = await getFaqs("fr");
    expect(result).toHaveLength(1);
  });

  it("sorts by order then by date descending", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([
      { name: "[FAQ] Second", view_id: "v2", last_edited_time: "2025-01-10T00:00:00Z" },
      { name: "[FAQ] First", view_id: "v1", last_edited_time: "2025-01-20T00:00:00Z" },
      { name: "[FAQ] Third no order", view_id: "v3", last_edited_time: "2025-01-05T00:00:00Z" },
    ]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText
      .mockResolvedValueOnce("**Published**: true\n**Order**: 2")
      .mockResolvedValueOnce("**Published**: true\n**Order**: 1")
      .mockResolvedValueOnce("**Published**: true");
    const result = await getFaqs();
    expect(result.map((f) => f.id)).toEqual(["v1", "v2", "v3"]);
  });

  it("uses full markdown as answer when Answer field is missing", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[FAQ] No answer field", "view-noanswer")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Published**: true\nSome fallback content here.");
    const result = await getFaqs();
    expect(result[0].answer).toBe("**Published**: true\nSome fallback content here.");
  });

  it("handles getDocument errors gracefully and uses empty markdown", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[FAQ] Error view", "view-err")]);
    mockGetDocument.mockRejectedValue(new Error("Network error"));
    // extractDocText won't be called, markdown stays ""
    // With empty markdown and Published not "true", it's skipped
    const result = await getFaqs();
    expect(result).toHaveLength(0);
  });

  it("handles Published: yes as truthy", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[FAQ] Yes published", "view-yes")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Published**: yes\n**Answer**: Yes means published");
    const result = await getFaqs();
    expect(result).toHaveLength(1);
    expect(result[0].published).toBe(true);
  });

  it("uses 'general' as default category when Category is not set", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[FAQ] No category FAQ", "view-nocat")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Published**: true\n**Answer**: Some answer");
    const result = await getFaqs();
    expect(result[0].category).toBe("general");
  });

  it("returns [] when listAllViewsDeep throws", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockRejectedValue(new Error("Views error"));
    const result = await getFaqs();
    expect(result).toEqual([]);
  });

  it("returns [] when listAllWorkspaces throws", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockRejectedValue(new Error("Workspace error"));
    const result = await getFaqs();
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// appflowy-faqs.ts — getFaqsByCategory()
// ===========================================================================
describe("getFaqsByCategory()", () => {
  it("returns only FAQs matching the given category", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([
      makeView("[FAQ] Pricing question", "view-p"),
      makeView("[FAQ] Technical question", "view-t"),
    ]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText
      .mockResolvedValueOnce("**Published**: true\n**Category**: pricing\n**Answer**: A")
      .mockResolvedValueOnce("**Published**: true\n**Category**: technical\n**Answer**: B");

    const result = await getFaqsByCategory("pricing");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("pricing");
  });

  it("returns empty array when no FAQs match category", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[FAQ] Some FAQ", "view-s")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Published**: true\n**Category**: general\n**Answer**: X");

    const result = await getFaqsByCategory("process");
    expect(result).toHaveLength(0);
  });
});

// ===========================================================================
// appflowy-faqs.ts — getAllFaqsAdmin()
// ===========================================================================
describe("getAllFaqsAdmin()", () => {
  it("returns converted staticFaqs when not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    const result = await getAllFaqsAdmin();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sf-1");
    expect(result[0].published).toBe(true);
    expect(result[0].date).toBeDefined();
  });

  it("returns [] when workspace list is empty", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue([]);
    const result = await getAllFaqsAdmin();
    expect(result).toEqual([]);
  });

  it("returns all FAQs including unpublished", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([
      makeView("[FAQ] Published FAQ", "view-pub"),
      makeView("[FAQ] Unpublished FAQ", "view-unp"),
    ]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText
      .mockResolvedValueOnce("**Published**: true\n**Answer**: Public answer")
      .mockResolvedValueOnce("**Published**: false\n**Answer**: Private answer");

    const result = await getAllFaqsAdmin();
    expect(result).toHaveLength(2);
    expect(result.find((f) => f.id === "view-pub")?.published).toBe(true);
    expect(result.find((f) => f.id === "view-unp")?.published).toBe(false);
  });

  it("returns converted staticFaqs when listAllViewsDeep throws", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockRejectedValue(new Error("Network error"));
    const result = await getAllFaqsAdmin();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sf-1");
  });

  it("ignores views not matching [FAQ] prefix", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([
      makeView("Meeting Notes"),
      makeView("[Service] Cloud Audit"),
      makeView("[FAQ] Real FAQ", "view-real"),
    ]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Answer**: A real FAQ answer\n**Published**: true");

    const result = await getAllFaqsAdmin();
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe("Real FAQ");
  });
});

// ===========================================================================
// appflowy-services.ts — getServices()
// ===========================================================================
describe("getServices()", () => {
  it("returns [] when AppFlowy is not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    const result = await getServices();
    expect(result).toEqual([]);
    expect(mockListWorkspaces).not.toHaveBeenCalled();
  });

  it("returns [] when workspace list is empty", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue([]);
    const result = await getServices();
    expect(result).toEqual([]);
  });

  it("returns [] when no views match [Service] prefix", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([
      makeView("[FAQ] Some FAQ"),
      makeView("[Testimonial] Some Testimonial"),
      makeView("Random page"),
    ]);
    const result = await getServices();
    expect(result).toEqual([]);
  });

  it("parses a [Service] view with all fields", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Service] Cloud Audit", "view-svc-1")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue(
      "**Slug**: cloud-audit\n**Description**: Full AWS audit\n**Price**: From €1,500\n**Category**: audit\n**Features**: Security review; Cost optimisation\n**CTA**: Book an audit\n**Icon**: 🔍"
    );

    const result = await getServices();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "view-svc-1",
      slug: "cloud-audit",
      name: "Cloud Audit",
      description: "Full AWS audit",
      price: "From €1,500",
      category: "audit",
      cta: "Book an audit",
      icon: "🔍",
    });
    expect(result[0].features).toEqual(["Security review", "Cost optimisation"]);
  });

  it("strips [Service] prefix from name", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Service] Monthly Retainer", "view-svc-2")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("");

    const result = await getServices();
    expect(result[0].name).toBe("Monthly Retainer");
  });

  it("slugifies name when Slug field is missing", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Service] Cloud Security Review", "view-svc-3")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Description**: Security check");

    const result = await getServices();
    expect(result[0].slug).toBe("cloud-security-review");
  });

  it("uses default cta 'Contact us' and icon '⚡' when not in markdown", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Service] Minimal Service", "view-svc-min")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("");

    const result = await getServices();
    expect(result[0].cta).toBe("Contact us");
    expect(result[0].icon).toBe("⚡");
  });

  it("uses 'consulting' as default category when Category is not set", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Service] No Category Svc", "view-svc-nc")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Description**: Something");

    const result = await getServices();
    expect(result[0].category).toBe("consulting");
  });

  it("splits features by semicolons", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Service] Multi Feature Svc", "view-svc-mf")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue(
      "**Features**: Security audit; Cost analysis; Architecture review"
    );

    const result = await getServices();
    expect(result[0].features).toEqual(["Security audit", "Cost analysis", "Architecture review"]);
  });

  it("handles getDocument errors gracefully with empty markdown", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Service] Error Svc", "view-svc-err")]);
    mockGetDocument.mockRejectedValue(new Error("Doc fetch failed"));

    const result = await getServices();
    // Service is still returned, just with empty/default field values
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Error Svc");
    expect(result[0].description).toBe("");
  });

  it("returns [] when listAllViewsDeep throws", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockRejectedValue(new Error("Views error"));
    const result = await getServices();
    expect(result).toEqual([]);
  });

  it("captures optional StripePriceId field", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Service] Stripe Service", "view-svc-stripe")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue(
      "**Slug**: stripe-svc\n**StripePriceId**: price_12345abc"
    );

    const result = await getServices();
    expect(result[0].stripePriceId).toBe("price_12345abc");
  });

  it("leaves stripePriceId undefined when field absent", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Service] No Stripe", "view-svc-nostripe")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Slug**: no-stripe");

    const result = await getServices();
    expect(result[0].stripePriceId).toBeUndefined();
  });
});

// ===========================================================================
// appflowy-testimonials.ts — getTestimonials()
// ===========================================================================
describe("getTestimonials()", () => {
  it("returns [] when AppFlowy is not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    const result = await getTestimonials();
    expect(result).toEqual([]);
    expect(mockListWorkspaces).not.toHaveBeenCalled();
  });

  it("returns [] when workspace list is empty", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue([]);
    const result = await getTestimonials();
    expect(result).toEqual([]);
  });

  it("returns [] when no views match [Testimonial] prefix", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([
      makeView("[FAQ] Some FAQ"),
      makeView("[Service] Some Service"),
    ]);
    const result = await getTestimonials();
    expect(result).toEqual([]);
  });

  it("parses a [Testimonial] view with all fields", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Testimonial] John Doe", "view-test-1")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue(
      "**Company**: Acme Corp\n**Role**: CEO\n**Quote**: Best cloud team ever!\n**Rating**: 5\n**Featured**: true\n**Avatar**: https://example.com/avatar.jpg\n**Service**: Cloud Audit"
    );

    const result = await getTestimonials();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "view-test-1",
      name: "John Doe",
      company: "Acme Corp",
      role: "CEO",
      quote: "Best cloud team ever!",
      rating: 5,
      featured: true,
      avatar: "https://example.com/avatar.jpg",
      service: "Cloud Audit",
    });
  });

  it("strips [Testimonial] prefix from name", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Testimonial] Jane Smith", "view-test-js")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Quote**: Amazing!");

    const result = await getTestimonials();
    expect(result[0].name).toBe("Jane Smith");
  });

  it("caps rating at 5 even if markdown says higher", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Testimonial] Over Rater", "view-test-or")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Rating**: 10\n**Quote**: Best ever!");

    const result = await getTestimonials();
    expect(result[0].rating).toBe(5);
  });

  it("sets rating to undefined when Rating field is missing", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Testimonial] No Rater", "view-test-nr")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Quote**: Good service.");

    const result = await getTestimonials();
    expect(result[0].rating).toBeUndefined();
  });

  it("sets rating to undefined when Rating is 0", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Testimonial] Zero Rater", "view-test-zr")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Rating**: 0\n**Quote**: Meh.");

    const result = await getTestimonials();
    expect(result[0].rating).toBeUndefined();
  });

  it("parses featured: yes as truthy", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Testimonial] Yes Featured", "view-test-yf")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Featured**: yes\n**Quote**: Wow!");

    const result = await getTestimonials();
    expect(result[0].featured).toBe(true);
  });

  it("parses featured: false as falsy", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Testimonial] Not Featured", "view-test-nf")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Featured**: false\n**Quote**: OK.");

    const result = await getTestimonials();
    expect(result[0].featured).toBe(false);
  });

  it("falls back to full markdown as quote when Quote field is missing", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Testimonial] No Quote Field", "view-test-nq")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Company**: Acme\nJust some raw testimonial text.");

    const result = await getTestimonials();
    expect(result[0].quote).toBe("**Company**: Acme\nJust some raw testimonial text.");
  });

  it("leaves avatar and service undefined when fields are absent", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Testimonial] Minimal", "view-test-min")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Quote**: Simple quote.");

    const result = await getTestimonials();
    expect(result[0].avatar).toBeUndefined();
    expect(result[0].service).toBeUndefined();
  });

  it("handles getDocument errors and uses empty markdown as quote", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Testimonial] Error Testimonial", "view-test-err")]);
    mockGetDocument.mockRejectedValue(new Error("Fetch failed"));

    const result = await getTestimonials();
    // Still returns the testimonial but quote is empty markdown fallback
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Error Testimonial");
    expect(result[0].quote).toBe("");
  });

  it("returns [] when listAllViewsDeep throws", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockRejectedValue(new Error("Views error"));
    const result = await getTestimonials();
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// appflowy-testimonials.ts — getFeaturedTestimonials()
// ===========================================================================
describe("getFeaturedTestimonials()", () => {
  it("returns only featured testimonials", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([
      makeView("[Testimonial] Featured One", "view-feat-1"),
      makeView("[Testimonial] Not Featured", "view-feat-2"),
    ]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText
      .mockResolvedValueOnce("**Featured**: true\n**Quote**: Great!")
      .mockResolvedValueOnce("**Featured**: false\n**Quote**: OK.");

    const result = await getFeaturedTestimonials();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("view-feat-1");
    expect(result[0].featured).toBe(true);
  });

  it("returns [] when AppFlowy is not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    const result = await getFeaturedTestimonials();
    expect(result).toEqual([]);
  });

  it("returns [] when no testimonials are featured", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([makeView("[Testimonial] Not Featured", "view-nfeat")]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Featured**: false\n**Quote**: Meh.");

    const result = await getFeaturedTestimonials();
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// appflowy-testimonials.ts — getAllTestimonialsAdmin()
// ===========================================================================
describe("getAllTestimonialsAdmin()", () => {
  it("returns staticTestimonials when not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    const result = await getAllTestimonialsAdmin();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("st-1");
    expect(result[0].name).toBe("Jane Doe");
    expect(mockListWorkspaces).not.toHaveBeenCalled();
  });

  it("returns [] when workspace list is empty", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue([]);
    const result = await getAllTestimonialsAdmin();
    expect(result).toEqual([]);
  });

  it("returns all testimonials when configured", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([
      makeView("[Testimonial] Alpha", "view-adm-1"),
      makeView("[Testimonial] Beta", "view-adm-2"),
    ]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText
      .mockResolvedValueOnce("**Quote**: Alpha quote\n**Featured**: true")
      .mockResolvedValueOnce("**Quote**: Beta quote\n**Featured**: false");

    const result = await getAllTestimonialsAdmin();
    expect(result).toHaveLength(2);
    expect(result[0].quote).toBe("Alpha quote");
    expect(result[1].quote).toBe("Beta quote");
  });

  it("returns staticTestimonials when listAllViewsDeep throws", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockRejectedValue(new Error("Network error"));

    const result = await getAllTestimonialsAdmin();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("st-1");
  });

  it("ignores views not matching [Testimonial] prefix", async () => {
    mockIsConfigured.mockResolvedValue(true);
    mockListWorkspaces.mockResolvedValue(makeWorkspace());
    mockListViews.mockResolvedValue([
      makeView("[FAQ] Some FAQ"),
      makeView("[Testimonial] Real One", "view-real-t"),
      makeView("Plain page"),
    ]);
    mockGetDocument.mockResolvedValue({});
    mockExtractDocText.mockResolvedValue("**Quote**: Real testimonial.");

    const result = await getAllTestimonialsAdmin();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Real One");
  });
});
