import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import rawMessages from "../src/locales/en.json";

const messages = rawMessages as unknown as AbstractIntlMessages;
import JsonLd from "@/components/JsonLd";
import HolographicCard from "@/components/HolographicCard";
import ScrollReveal from "@/components/ScrollReveal";
import Navbar from "@/components/Navbar";
import { CartProvider } from "@/context/CartContext";

// Mock IntersectionObserver for components that use it
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
  takeRecords = vi.fn().mockReturnValue([]);
  root = null;
  rootMargin = "0px";
  thresholds = [0];
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
// Mock useAuth so Navbar doesn't need AuthProvider + Amplify config
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isAdmin: false,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    confirmSignUp: vi.fn(),
    resetPassword: vi.fn(),
    confirmResetPassword: vi.fn(),
    confirmSignIn: vi.fn(),
  }),
}));

// Mock next/navigation (no real Next.js App Router in jsdom)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

// Provide i18n navigation adapter (createNavigation needs App Router which doesn't exist in jsdom)
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={typeof href === "string" ? href : "/"} {...props}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  redirect: vi.fn(),
  getPathname: vi.fn(),
}));

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("JsonLd", () => {
  it("renders a script tag with application/ld+json type", () => {
    const data = { "@type": "Organization", name: "Cloudless" };
    const { container } = render(<JsonLd data={data} />);

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).toBeTruthy();
    expect(script?.innerHTML).toBe(JSON.stringify(data));
  });

  it("handles array data", () => {
    const data = [
      { "@type": "Organization", name: "Cloudless" },
      { "@type": "WebSite", url: "https://cloudless.gr" },
    ];
    const { container } = render(<JsonLd data={data} />);

    const script = container.querySelector(
      'script[type="application/ld+json"]',    );
    expect(script).toBeTruthy();
    const parsed = JSON.parse(script!.innerHTML);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });
});

describe("HolographicCard", () => {
  it("renders children correctly", () => {
    render(
      <HolographicCard>
        <p>Hello Card</p>
      </HolographicCard>,
    );

    expect(screen.getByText("Hello Card")).toBeTruthy();
  });

  it("applies custom className", () => {
    const { container } = render(
      <HolographicCard className="test-class">
        <p>Content</p>
      </HolographicCard>,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("test-class");
  });
  it("includes holographic glare overlay", () => {
    const { container } = render(
      <HolographicCard>
        <p>Content</p>
      </HolographicCard>,
    );

    // Should have the glare overlay div (pointer-events-none)
    const overlays = container.querySelectorAll(".pointer-events-none");
    expect(overlays.length).toBeGreaterThan(0);
  });
});

describe("ScrollReveal", () => {
  it("renders children inside a reveal wrapper", () => {
    const { container } = render(
      <ScrollReveal>
        <p>Revealed content</p>
      </ScrollReveal>,
    );

    expect(screen.getByText("Revealed content")).toBeTruthy();
    const wrapper = container.firstElementChild;
    expect(wrapper?.classList.contains("reveal")).toBe(true);
  });

  it("applies custom className alongside reveal", () => {    const { container } = render(
      <ScrollReveal className="my-custom-class">
        <p>Content</p>
      </ScrollReveal>,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.classList.contains("reveal")).toBe(true);
    expect(wrapper?.classList.contains("my-custom-class")).toBe(true);
  });

  it("sets up IntersectionObserver on mount", () => {
    render(
      <ScrollReveal>
        <p>Observed</p>
      </ScrollReveal>,
    );

    expect(mockObserve).toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────
// Navbar
// ──────────────────────────────────────────

describe("Navbar", () => {
  let preventLinkNavigation: (e: MouseEvent) => void;

  beforeEach(() => {
    document.cookie = `NEXT_LOCALE=en; path=/`;    document.documentElement.lang = "en";
    // Prevent jsdom "Not implemented: navigation to another Document" on anchor clicks
    preventLinkNavigation = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target instanceof HTMLAnchorElement || target?.closest?.("a")) {
        e.preventDefault();
      }
    };
    document.addEventListener("click", preventLinkNavigation, true);
  });

  afterEach(() => {
    document.removeEventListener("click", preventLinkNavigation, true);
  });

  function renderNavbar() {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CartProvider>
          <Navbar />
        </CartProvider>
      </NextIntlClientProvider>,
    );
  }

  it("renders the logo and desktop nav links", () => {
    const { container } = renderNavbar();
    const view = within(container);

    expect(view.getByText("cloudless")).toBeTruthy();
    expect(view.getByText(".gr")).toBeTruthy();

    // Desktop links are present in the DOM
    const homeLinks = view.getAllByText("Home");
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders a hamburger button for mobile", () => {
    const { container } = renderNavbar();
    const view = within(container);

    const toggle = view.getByLabelText("Toggle menu");
    expect(toggle).toBeTruthy();
  });
  it("shows mobile menu with nav links and cart on hamburger click", () => {
    const { container } = renderNavbar();
    const view = within(container);

    fireEvent.click(view.getByLabelText("Toggle menu"));

    // Mobile menu should be visible (opacity-100)
    const mobileMenu = container.querySelector(".lg\\:hidden.bg-void\\/95");
    expect(mobileMenu?.className).toContain("opacity-100");

    // Cart row visible in mobile menu
    expect(view.getByText("Cart")).toBeTruthy();
  });

  it("closes mobile menu when a nav link is clicked", () => {
    const { container } = renderNavbar();
    const view = within(container);

    // Open menu
    fireEvent.click(view.getByLabelText("Toggle menu"));

    // Click a link in the mobile menu
    const mobileLinks = view.getAllByText("Services");
    const mobileLink = mobileLinks.find((el) => el.closest(".lg\\:hidden"));
    if (mobileLink) fireEvent.click(mobileLink);

    // Menu should be collapsed (opacity-0)
    const mobileMenu = container.querySelector(".lg\\:hidden.bg-void\\/95");
    expect(mobileMenu?.className).toContain("opacity-0");  });

  it("renders Sign In CTA in both desktop and mobile when unauthenticated", () => {
    const { container } = renderNavbar();
    const view = within(container);

    const ctas = view.getAllByText("Sign In");
    expect(ctas.length).toBe(2); // desktop + mobile
  });

  it("has 44px minimum touch targets on mobile nav links", () => {
    const { container } = renderNavbar();

    