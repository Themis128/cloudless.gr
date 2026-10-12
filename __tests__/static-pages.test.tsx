/**
 * Static/semistatic public pages — terms, privacy, refund, accessibility,
 * partners, contact, playbook, agents, work, store trio, admin/notion shim.
 * Async RSCs are awaited then rendered; client components are stubbed.
 *
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("notFound");
  })
);
const i18nRedirect = vi.hoisted(() =>
  vi.fn((opts: { href: string }) => {
    throw new Error(`REDIRECT:${opts.href}`);
  })
);

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  redirect: (opts: { href: string }) => i18nRedirect(opts),
}));
vi.mock("@/lib/server-locale", () => ({ getServerLocale: vi.fn(async () => "en") }));
vi.mock("@/components/JsonLd", () => ({ default: () => null }));
vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ContactFormSection", () => ({
  default: () => <div data-testid="contact-form">CONTACT_FORM</div>,
}));
vi.mock("@/components/PlaybookLeadForm", () => ({
  default: () => <div data-testid="lead-form">LEAD_FORM</div>,
}));
vi.mock("@/components/AgentCounter", () => ({ default: () => <span>AGENTS</span> }));
vi.mock("@/components/store/StoreGrid", () => ({ default: () => <div>STORE_GRID</div> }));
vi.mock("@/components/store/RecommendationGrid", () => ({
  default: () => <div>RECOMMENDATIONS</div>,
}));
vi.mock("@/components/store/AddToCartButton", () => ({
  default: () => <button>ADD_TO_CART</button>,
}));
vi.mock("@/components/store/ProductIcon", () => ({ default: () => <span /> }));
vi.mock("@/components/ProjectCard", () => ({
  default: ({ project }: { project: { title?: string } }) => <div>{project.title}</div>,
}));
const listProjectsMock = vi.hoisted(() => vi.fn());
const appflowyConfigured = vi.hoisted(() => vi.fn(async () => false));
vi.mock("@/lib/appflowy-projects", () => ({ listProjects: listProjectsMock }));
vi.mock("@/lib/appflowy", () => ({ isAppFlowyConfigured: appflowyConfigured }));

import TermsPage from "@/app/[locale]/terms/page";
import PrivacyPage from "@/app/[locale]/privacy/page";
import RefundPage from "@/app/[locale]/refund/page";
import AccessibilityPage from "@/app/[locale]/accessibility/page";
import PartnersPage from "@/app/[locale]/partners/page";
import ContactPage from "@/app/[locale]/contact/page";
import PlaybookPage from "@/app/[locale]/playbook/page";
import AgentsPage from "@/app/[locale]/agents/page";
import WorkPage from "@/app/[locale]/work/page";
import StorePage from "@/app/[locale]/store/page";
import ProductPage from "@/app/[locale]/store/[id]/page";
import SuccessPage from "@/app/[locale]/store/success/page";
import LegacyNotionRedirectPage from "@/app/[locale]/admin/notion/[[...slug]]/page";

const sp = (params: Record<string, unknown> = {}) =>
  Promise.resolve(params) as Promise<Record<string, unknown>>;

afterEach(() => cleanup());

describe("legal pages", () => {
  it.each([
    ["terms", TermsPage, /terms|conditions/i],
    ["privacy", PrivacyPage, /privacy|data/i],
    ["refund", RefundPage, /refund|return/i],
    ["accessibility", AccessibilityPage, /accessib|WCAG/i],
  ])("%s renders policy content", async (_name, Page, pattern) => {
    const jsx = await (Page as () => Promise<React.ReactElement>)();
    const { container } = render(jsx);
    expect(container.textContent).toMatch(pattern);
  });
});

describe("marketing pages", () => {
  it("partners renders with contact form", async () => {
    const { container } = render(
      await PartnersPage({ params: sp({ locale: "en" }) })
    );
    expect(container.textContent).toContain("CONTACT_FORM");
  });

  it("contact renders the form section", async () => {
    const { container } = render(await ContactPage({ params: sp({ locale: "en" }) }));
    expect(container.textContent).toContain("CONTACT_FORM");
  });

  it("playbook renders the lead form", async () => {
    const { container } = render(await PlaybookPage({ params: sp({ locale: "en" }) }));
    expect(container.textContent).toContain("LEAD_FORM");
  });

  it("agents page renders", () => {
    const { container } = render(<AgentsPage />);
    expect(container.textContent).toContain("AGENTS");
  });
});

describe("work page", () => {
  it("renders projects when AppFlowy is configured", async () => {
    appflowyConfigured.mockResolvedValueOnce(true);
    listProjectsMock.mockResolvedValueOnce([
      { id: "p1", title: "Migration Case", type: "Client", status: "Completed" },
      { id: "p2", title: "Internal Tool", type: "Internal", status: "Completed" },
    ]);
    const { container } = render(await WorkPage({ params: sp({ locale: "en" }) }));
    expect(container.textContent).toContain("Migration Case");
  });

  it("renders the page when AppFlowy is unconfigured", async () => {
    const { container } = render(await WorkPage({ params: sp({ locale: "en" }) }));
    expect(container.textContent).toMatch(/work|case|project/i);
  });
});

describe("store pages", () => {
  it("store grid page renders", () => {
    const { container } = render(<StorePage />);
    expect(container.textContent).toContain("STORE_GRID");
  });

  it("product page renders a real product from store-products", async () => {
    const { container } = render(
      await ProductPage({ params: sp({ locale: "en", id: "srv-cloud" }) })
    );
    expect(container.textContent).toContain("ADD_TO_CART");
  });

  it("product page calls notFound for unknown ids", async () => {
    await expect(
      ProductPage({ params: sp({ locale: "en", id: "nope-nothing" }) })
    ).rejects.toThrow("notFound");
  });

  it("success page renders", () => {
    const { container } = render(<SuccessPage />);
    expect(container.textContent).toMatch(/success|thank|order|purchase/i);
  });
});

describe("admin/notion legacy redirect", () => {
  it("maps legacy slugs to AppFlowy paths", async () => {
    await expect(
      LegacyNotionRedirectPage({ params: sp({ locale: "en", slug: ["tasks"] }) })
    ).rejects.toThrow("REDIRECT:/admin/appflowy/tasks");
  });

  it("falls back to AppFlowy home for unknown/no slug", async () => {
    await expect(
      LegacyNotionRedirectPage({ params: sp({ locale: "en" }) })
    ).rejects.toThrow("REDIRECT:/admin/appflowy");
  });
});
