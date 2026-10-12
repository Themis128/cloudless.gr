// @vitest-environment node
/**
 * Tail coverage — icons/[name] fallback paths, /api/analytics/track
 * validation + consent gate, playbook-lead validation leftovers,
 * admin email/contacts CRM tab, public CMS list-route catch fallbacks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 99 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
  resetRateLimitStore: vi.fn(),
}));

const verifyTurnstileTokenMock = vi.fn();
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: (...args: unknown[]) => verifyTurnstileTokenMock(...args),
}));

vi.mock("@/lib/admin-notifications", () => ({
  recordNotification: vi.fn(),
}));

const getConfigMock = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: () => getConfigMock(),
}));

const readFileMock = vi.fn();
vi.mock("fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("fs/promises")>()),
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

vi.mock("@/lib/auth", () => ({ auth: () => Promise.resolve(null) }));

const requireAdminMock = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

const espo = vi.hoisted(() => ({
  isEspoCRMConfigured: vi.fn(),
  searchContacts: vi.fn(),
  listContacts: vi.fn(),
}));
vi.mock("@/lib/espocrm", () => espo);

const cmsCfg = vi.hoisted(() => ({ configured: true }));
vi.mock("@/lib/cms-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cms-provider")>()),
  isAppFlowyCmsConfigured: () => cmsCfg.configured,
}));

const caseStudiesLib = vi.hoisted(() => ({
  getCaseStudies: vi.fn(),
  getFeaturedCaseStudies: vi.fn(),
}));
vi.mock("@/lib/appflowy-case-studies", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/appflowy-case-studies")>()),
  getCaseStudies: (...a: unknown[]) => caseStudiesLib.getCaseStudies(...a),
  getFeaturedCaseStudies: (...a: unknown[]) => caseStudiesLib.getFeaturedCaseStudies(...a),
}));

const testimonialsLib = vi.hoisted(() => ({
  getTestimonials: vi.fn(),
  getFeaturedTestimonials: vi.fn(),
}));
vi.mock("@/lib/appflowy-testimonials", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/appflowy-testimonials")>()),
  getTestimonials: (...a: unknown[]) => testimonialsLib.getTestimonials(...a),
  getFeaturedTestimonials: (...a: unknown[]) =>
    testimonialsLib.getFeaturedTestimonials(...a),
}));

const trackEvent = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const recordFunnel = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("@/lib/analytics", () => ({ trackAnalyticsEvent: trackEvent }));
vi.mock("@/lib/search-funnel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/search-funnel")>()),
  recordFunnelEvent: recordFunnel,
}));

function post(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /icons/[name]", () => {
  it("404s for an unmapped icon name", async () => {
    const { GET } = await import("@/app/icons/[name]/route");
    const res = await GET(new Request("http://x/icons/nope.png"), {
      params: Promise.resolve({ name: "nope.png" }),
    });
    expect(res.status).toBe(404);
  });

  it("serves the 1x1 fallback PNG when no icon file exists", async () => {
    readFileMock.mockRejectedValue(new Error("ENOENT"));
    const { GET } = await import("@/app/icons/[name]/route");
    const res = await GET(new Request("http://x/icons/icon-192.png"), {
      params: Promise.resolve({ name: "icon-192.png" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
  });

  it("serves the real file bytes with the immutable cache header", async () => {
    readFileMock.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const { GET } = await import("@/app/icons/[name]/route");
    const res = await GET(new Request("http://x/icons/icon-192.png"), {
      params: Promise.resolve({ name: "icon-192.png" }),
    });
    expect(res.headers.get("Cache-Control")).toContain("immutable");
  });
});

describe("POST /api/analytics/track", () => {
  it("400s on invalid JSON and on a missing event", async () => {
    const { POST } = await import("@/app/api/analytics/track/route");
    const bad = await POST(post("http://x/api/analytics/track", "{oops"));
    expect(bad.status).toBe(400);
    const missing = await POST(post("http://x/api/analytics/track", { page: "/x" }));
    expect(missing.status).toBe(400);
  });

  it("returns ok without tracking when analytics consent is absent", async () => {
    const { POST } = await import("@/app/api/analytics/track/route");
    const res = await POST(post("http://x/api/analytics/track", { event: "page_view" }));
    expect(res.status).toBe(200);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("tracks when the consent cookie grants analytics", async () => {
    const { POST } = await import("@/app/api/analytics/track/route");
    const cookie = `cookieConsent=${encodeURIComponent(JSON.stringify({ analytics: true }))}`;
    const res = await POST(
      post("http://x/api/analytics/track", { event: "page_view" }, { cookie }),
    );
    expect(res.status).toBe(200);
    expect(trackEvent).toHaveBeenCalled();
  });

  it("routes funnel events to the D1 funnel sink", async () => {
    const { POST } = await import("@/app/api/analytics/track/route");
    const cookie = `cookieConsent=${encodeURIComponent(JSON.stringify({ analytics: true }))}`;
    const res = await POST(
      post(
        "http://x/api/analytics/track",
        { event: "search_query", session_id: "sess-123" },
        { cookie },
      ),
    );
    const data = await res.json();
    expect(data.sink).toBe("d1-funnel");
    expect(recordFunnel).toHaveBeenCalled();
  });
});

describe("POST /api/playbook-lead — tails", () => {
  beforeEach(() => {
    verifyTurnstileTokenMock.mockResolvedValue({ ok: true });
    getConfigMock.mockResolvedValue({ SOCIALAUTO_SERVICE_TOKEN: "t:t" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"ok":true}')));
  });

  const VALID = { email: "jane@example.com", consent: true };

  it("tolerates an unparseable referer header", async () => {
    const { POST } = await import("@/app/api/playbook-lead/route");
    const res = await POST(
      post("http://x/api/playbook-lead", VALID, { referer: "::::not a url" }),
    );
    expect(res.status).toBe(200);
  });

  it("400s on a JSON body that is not an object", async () => {
    const { POST } = await import("@/app/api/playbook-lead/route");
    const res = await POST(post("http://x/api/playbook-lead", "null"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid request body.");
  });

  it("400s when name is not a string", async () => {
    const { POST } = await import("@/app/api/playbook-lead/route");
    const res = await POST(
      post("http://x/api/playbook-lead", { ...VALID, name: 42 }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Name must be a string");
  });
});

describe("GET /api/admin/email/contacts", () => {
  beforeEach(() => {
    requireAdminMock.mockResolvedValue({ ok: true });
    espo.isEspoCRMConfigured.mockResolvedValue(true);
  });

  it("lists CRM contacts for non-subscriber tabs", async () => {
    espo.listContacts.mockResolvedValue([{ id: "c1", name: "Jane" }]);
    const { GET } = await import("@/app/api/admin/email/contacts/route");
    const res = await GET(new Request("http://x/api/admin/email/contacts?tab=all") as never);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.contacts[0].id).toBe("c1");
  });

  it("500s when the CRM lookup throws", async () => {
    espo.listContacts.mockRejectedValue(new Error("espo down"));
    const { GET } = await import("@/app/api/admin/email/contacts/route");
    const res = await GET(new Request("http://x/api/admin/email/contacts?tab=all") as never);
    expect(res.status).toBe(500);
  });
});

describe("public CMS list routes — catch fallbacks", () => {
  it("case-studies serves the static featured list when AppFlowy throws", async () => {
    cmsCfg.configured = true;
    caseStudiesLib.getFeaturedCaseStudies.mockRejectedValue(new Error("appflowy down"));
    const { GET } = await import("@/app/api/case-studies/route");
    const res = await GET(new Request("http://x/api/case-studies?featured=true"));
    const data = (await res.json()) as { featured?: boolean }[];
    expect(res.status).toBe(200);
    expect(res.headers.get("x-cms-source")).toContain("static");
    expect(data.every((c) => c.featured)).toBe(true);
  });

  it("testimonials serves the static featured list when AppFlowy throws", async () => {
    cmsCfg.configured = true;
    testimonialsLib.getFeaturedTestimonials.mockRejectedValue(new Error("appflowy down"));
    const { GET } = await import("@/app/api/testimonials/route");
    const res = await GET(new Request("http://x/api/testimonials?featured=true"));
    const data = (await res.json()) as { featured?: boolean }[];
    expect(res.status).toBe(200);
    expect(data.every((t) => t.featured)).toBe(true);
  });
});
