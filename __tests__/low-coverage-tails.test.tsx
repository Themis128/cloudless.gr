/**
 * Tail coverage for low-covered modules: the three AppFlowy admin CMS routes
 * (their `createRequired.read` accessors), the ad-analytics anomalies error
 * path, the postiz missing-content error matrix, the ssr:false client
 * wrappers, and TrackedBlogCard's click tracking.
 *
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { trackClientEventMock } = vi.hoisted(() => ({
  trackClientEventMock: vi.fn(),
}));

vi.mock("@/lib/track-client-event", () => ({
  trackClientEvent: (...a: unknown[]) => trackClientEventMock(...a),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: async () => ({ ok: true, user: { sub: "admin" } }),
}));

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: async () => true,
}));

const { writeNotImplementedMock } = vi.hoisted(() => ({
  writeNotImplementedMock: vi.fn(),
}));

vi.mock("@/lib/appflowy-admin-stub", () => ({
  appflowyWriteNotImplemented: (surface: string) => writeNotImplementedMock(surface),
}));

vi.mock("@/lib/appflowy-case-studies", () => ({
  getCaseStudies: async () => [{ id: "c1", title: "t" }],
}));
vi.mock("@/lib/appflowy-services", () => ({
  getServices: async () => [{ id: "s1", name: "n" }],
}));
vi.mock("@/lib/appflowy-testimonials", () => ({
  getAllTestimonialsAdmin: async () => [{ id: "t1", quote: "q" }],
}));

const { mockListAnomalyHistory, mockGetPostMissingContent } = vi.hoisted(() => ({
  mockListAnomalyHistory: vi.fn(),
  mockGetPostMissingContent: vi.fn(),
}));

vi.mock("@/lib/ad-analytics/anomaly-log", () => ({
  listAnomalyHistory: (...a: unknown[]) => mockListAnomalyHistory(...a),
}));

vi.mock("@/lib/postiz", async () => {
  const { NextResponse } = await import("next/server");
  void NextResponse;
  class PostizNotConfiguredError extends Error {}
  class PostizApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      super("upstream");
      this.status = status;
      this.body = body;
    }
  }
  return {
    getPostMissingContent: (...a: unknown[]) => mockGetPostMissingContent(...a),
    PostizNotConfiguredError,
    PostizApiError,
  };
});

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    onClick,
    className,
    style,
  }: {
    href: string;
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    style?: React.CSSProperties;
  }) => (
    <a href={href} onClick={onClick} className={className} style={style}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("@/lib/i18n", () => ({ translate: (_l: string, _k: string, fb: string) => fb }));
vi.mock("@/lib/blog", () => ({ formatDate: (d: string) => d }));

vi.mock("next/dynamic", () => ({
  default: (_loader: unknown, opts?: { loading?: () => React.ReactNode }) => {
    const Loaded = (props: Record<string, unknown>) => (
      <div data-testid="dynamic-stub" data-props={JSON.stringify(props)} />
    );
    // Exercise the loading fallback so the arrow fn is covered.
    opts?.loading?.();
    return Loaded;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  writeNotImplementedMock.mockImplementation(
    (surface: string) => NextResponse.json({ error: `${surface} write not implemented` }, { status: 501 }),
  );
  mockListAnomalyHistory.mockResolvedValue([{ id: "a1" }]);
  mockGetPostMissingContent.mockResolvedValue([{ id: "p1" }]);
});

afterEach(() => cleanup());

const adminReq = (url: string, init?: RequestInit) =>
  new NextRequest(url, { headers: { Authorization: "Bearer x" }, ...init });

describe("AppFlowy admin CMS routes", () => {
  const surfaces = [
    {
      name: "case-studies",
      path: "@/app/api/admin/appflowy/case-studies/route",
      listKey: "caseStudies",
      body: { title: "New study" },
    },
    {
      name: "services",
      path: "@/app/api/admin/appflowy/services/route",
      listKey: "services",
      body: { name: "New svc" },
    },
    {
      name: "testimonials",
      path: "@/app/api/admin/appflowy/testimonials/route",
      listKey: "testimonials",
      body: { name: "New t" },
    },
  ] as const;

  for (const s of surfaces) {
    it(`${s.name}: GET lists, POST validates required field`, async () => {
      const mod = (await import(s.path)) as {
        GET: (r: NextRequest) => Promise<Response>;
        POST: (r: NextRequest) => Promise<Response>;
        PATCH: (r: NextRequest) => Promise<Response>;
        DELETE: (r: NextRequest) => Promise<Response>;
      };
      const base = `http://localhost/api/admin/appflowy/${s.name}`;

      const getRes = await mod.GET(adminReq(base));
      expect(getRes.status).toBe(200);
      expect((await getRes.json())[s.listKey]).toHaveLength(1);

      // valid body → reaches createRequired.read then the write stub
      const postOk = await mod.POST(
        adminReq(base, { method: "POST", body: JSON.stringify(s.body) }),
      );
      expect(postOk.status).toBe(501);
      expect(writeNotImplementedMock).toHaveBeenCalled();

      const postBad = await mod.POST(
        adminReq(base, { method: "POST", body: JSON.stringify({}) }),
      );
      expect(postBad.status).toBe(400);

      const patchBad = await mod.PATCH(
        adminReq(base, { method: "PATCH", body: JSON.stringify({}) }),
      );
      expect(patchBad.status).toBe(400);

      const delBad = await mod.DELETE(adminReq(base, { method: "DELETE" }));
      expect(delBad.status).toBe(400);

      const delOk = await mod.DELETE(
        adminReq(`${base}?pageId=pg1`, { method: "DELETE" }),
      );
      expect(delOk.status).toBe(501);
    });
  }
});

describe("admin anomalies route tails", () => {
  it("clamps the limit parameter", async () => {
    const { GET } = await import("@/app/api/admin/ad-analytics/anomalies/route");
    const res = await GET(
      adminReq("http://localhost/api/admin/ad-analytics/anomalies?limit=9999"),
    );
    expect(res.status).toBe(200);
    expect(mockListAnomalyHistory).toHaveBeenCalledWith(200);
  });

  it("returns 500 when the history lookup throws a non-Error", async () => {
    mockListAnomalyHistory.mockRejectedValue("boom");
    const { GET } = await import("@/app/api/admin/ad-analytics/anomalies/route");
    const res = await GET(
      adminReq("http://localhost/api/admin/ad-analytics/anomalies"),
    );
    expect(res.status).toBe(500);
  });
});

describe("postiz missing-content route tails", () => {
  const url = "http://localhost/api/admin/postiz/posts/p1/missing-content";
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("returns 400 for an empty post id", async () => {
    const { GET } = await import(
      "@/app/api/admin/postiz/posts/[id]/missing-content/route"
    );
    const res = await GET(adminReq(url), params(""));
    expect(res.status).toBe(400);
  });

  it("returns items on success", async () => {
    const { GET } = await import(
      "@/app/api/admin/postiz/posts/[id]/missing-content/route"
    );
    const res = await GET(adminReq(url), params("p1"));
    expect(res.status).toBe(200);
    expect((await res.json()).items).toHaveLength(1);
  });

  it("maps PostizNotConfiguredError to 503", async () => {
    const { PostizNotConfiguredError } = await import("@/lib/postiz");
    mockGetPostMissingContent.mockRejectedValue(new PostizNotConfiguredError());
    const { GET } = await import(
      "@/app/api/admin/postiz/posts/[id]/missing-content/route"
    );
    const res = await GET(adminReq(url), params("p1"));
    expect(res.status).toBe(503);
  });

  it("maps PostizApiError to 502", async () => {
    const { PostizApiError } = await import("@/lib/postiz");
    mockGetPostMissingContent.mockRejectedValue(new PostizApiError(418, "teapot"));
    const { GET } = await import(
      "@/app/api/admin/postiz/posts/[id]/missing-content/route"
    );
    const res = await GET(adminReq(url), params("p1"));
    expect(res.status).toBe(502);
    expect((await res.json()).status).toBe(418);
  });

  it("rethrows unexpected errors", async () => {
    mockGetPostMissingContent.mockRejectedValue(new TypeError("nope"));
    const { GET } = await import(
      "@/app/api/admin/postiz/posts/[id]/missing-content/route"
    );
    await expect(GET(adminReq(url), params("p1"))).rejects.toThrow("nope");
  });
});

describe("ssr:false client wrappers", () => {
  it("ClientCartSlideOver renders the dynamic boundary", async () => {
    const C = (await import("@/components/ClientCartSlideOver")).default;
    const { container } = render(<C />);
    expect(container.querySelector("[data-testid=dynamic-stub]")).toBeTruthy();
  });

  it("ClientChatWidget renders the dynamic boundary", async () => {
    const C = (await import("@/components/ClientChatWidget")).default;
    const { container } = render(<C />);
    expect(container.querySelector("[data-testid=dynamic-stub]")).toBeTruthy();
  });

  it("ClientParticleField forwards props", async () => {
    const C = (await import("@/components/ClientParticleField")).default;
    const { container } = render(<C particleCount={42} color="#fff" />);
    const el = container.querySelector("[data-testid=dynamic-stub]");
    expect(el).toBeTruthy();
    expect(JSON.parse(el?.getAttribute("data-props") ?? "{}").particleCount).toBe(42);
  });
});

describe("TrackedBlogCard", () => {
  const post = {
    slug: "s1",
    title: "T",
    excerpt: "E",
    date: "2026-01-01",
    readTime: "5 min",
    category: "eng",
  };

  it("renders and tracks the click", async () => {
    const Card = (await import("@/components/TrackedBlogCard")).default;
    const { getByText } = render(<Card post={post} />);
    fireEvent.click(getByText("T"));
    expect(trackClientEventMock).toHaveBeenCalledWith("home_blog_highlights_click", {
      slug: "s1",
      category: "eng",
      position: "homepage",
    });
  });
});
