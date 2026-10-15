/**
 * Coverage for the zero-hit modules: metadata routes (robots, auth.md),
 * re-export barrels (auth-utils, ses-suppression, register-d1, cookies page,
 * middleware), interface contracts (ad-platform, notification), small client
 * components (TrackedLink, CounterAgentWidget, HomeNewsletterForm), the
 * services redirect page, and the static FAQ types.
 *
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { trackClientEventMock, newsletterProps, redirectMock } = vi.hoisted(() => ({
  trackClientEventMock: vi.fn(),
  newsletterProps: { current: undefined as { onSuccess?: () => void } | undefined },
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/track-client-event", () => ({
  trackClientEvent: (...a: unknown[]) => trackClientEventMock(...a),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string;
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/NewsletterForm", () => ({
  default: (props: { onSuccess?: () => void }) => {
    newsletterProps.current = props;
    return <div data-testid="newsletter-form" />;
  },
}));

vi.mock("@/app/[locale]/cookies/CookiePolicyPageClient", () => ({
  default: () => <div data-testid="cookie-policy" />,
}));

vi.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => redirectMock(url),
  redirect: (url: string) => redirectMock(url),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("robots.ts", () => {
  it("returns the MetadataRoute.Robots shape", async () => {
    const robots = (await import("@/app/robots")).default;
    const out = robots();
    expect(out.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(out.sitemap).toBe("https://cloudless.gr/sitemap.xml");
  });
});

describe("services/page.tsx redirect", () => {
  it("permanently redirects to /en/services", async () => {
    const ServicesPage = (await import("@/app/services/page")).default;
    ServicesPage();
    expect(redirectMock).toHaveBeenCalledWith("/en/services");
  });
});

describe("middleware.ts", () => {
  it("re-exports proxy and keeps the static matcher", async () => {
    const mw = await import("@/middleware");
    expect(typeof mw.default).toBe("function");
    expect(mw.config.matcher[0]).toContain("api/health");
  });
});

describe("auth.md route", () => {
  it("serves the agent auth doc as markdown", async () => {
    const { GET } = await import("@/app/auth.md/route");
    const res = await GET();
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    expect(await res.text()).toContain("client_credentials");
  });
});

describe("re-export barrels", () => {
  it("auth-utils re-exports the helpers", async () => {
    const m = await import("@/lib/auth-utils");
    for (const k of [
      "recordNotification",
      "sendActivationEmail",
      "notifyTeam",
      "slackRegistrationNotify",
      "hashPassword",
      "verifyPassword",
      "rateLimit",
      "getClientIp",
    ]) {
      expect(typeof m[k as keyof typeof m]).toBe("function");
    }
  });

  it("ses-suppression re-exports the D1 implementation", async () => {
    const m = await import("@/lib/ses-suppression");
    for (const k of [
      "addToSuppressionList",
      "removeFromSuppressionList",
      "isSuppressed",
      "getSuppressedEmails",
      "setD1Binding",
    ]) {
      expect(typeof m[k as keyof typeof m]).toBe("function");
    }
  });

  it("register-d1 aliases the register POST handler", async () => {
    const m = await import("@/app/api/auth/register-d1/route");
    const reg = await import("@/app/api/auth/register/route");
    expect(m.POST).toBe(reg.POST);
  });

  it("cookies page re-exports the client component", async () => {
    const m = await import("@/app/[locale]/cookies/page");
    expect(typeof m.default).toBe("function");
    const { container } = render(React.createElement(m.default));
    expect(container.querySelector("[data-testid=cookie-policy]")).toBeTruthy();
  });
});

describe("types/faqs.ts", () => {
  it("exposes static FAQs with valid shape", async () => {
    const { staticFaqs } = await import("@/types/faqs");
    expect(staticFaqs.length).toBeGreaterThan(0);
    for (const f of staticFaqs) {
      expect(f.id).toMatch(/^faq-/);
      expect(["general", "pricing", "technical", "process"]).toContain(f.category);
      expect(f.locales.length).toBeGreaterThan(0);
    }
  });
});

describe("interface contracts", () => {
  it("ad-platform adapter module loads", async () => {
    const m = await import("@/lib/ad-analytics/adapters/ad-platform");
    expect(m).toBeDefined();
  });

  it("notification channel module loads", async () => {
    const m = await import("@/lib/ad-analytics/channels/notification");
    expect(m).toBeDefined();
  });
});

describe("TrackedLink", () => {
  it("fires the analytics event on click", async () => {
    const TrackedLink = (await import("@/components/TrackedLink")).default;
    const { getByText } = render(
      <TrackedLink href="/x" event="cta_click" params={{ a: 1 }}>
        Go
      </TrackedLink>,
    );
    fireEvent.click(getByText("Go"));
    expect(trackClientEventMock).toHaveBeenCalledWith("cta_click", { a: 1 });
  });

  it("defaults params to an empty object", async () => {
    const TrackedLink = (await import("@/components/TrackedLink")).default;
    const { getByText } = render(
      <TrackedLink href="/x" event="cta_click">
        Go
      </TrackedLink>,
    );
    fireEvent.click(getByText("Go"));
    expect(trackClientEventMock).toHaveBeenCalledWith("cta_click", {});
  });
});

describe("CounterAgentWidget", () => {
  it("renders nothing", async () => {
    const { CounterAgentWidget } = await import("@/components/CounterAgentWidget");
    const { container } = render(<CounterAgentWidget />);
    expect(container.firstChild).toBeNull();
  });
});

describe("HomeNewsletterForm", () => {
  it("tracks subscription success", async () => {
    const HomeNewsletterForm = (await import("@/components/HomeNewsletterForm")).default;
    render(<HomeNewsletterForm />);
    newsletterProps.current?.onSuccess?.();
    expect(trackClientEventMock).toHaveBeenCalledWith("home_newsletter_subscribe", {
      position: "homepage",
    });
  });
});
