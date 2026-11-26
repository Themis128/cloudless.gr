// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ContactFormSection pulls App Router hooks + GSAP/Cloudflare widgets that
// have no meaning in jsdom — stub the boundaries, keep the real sidebar.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/lib/use-locale", () => ({
  useCurrentLocale: () => ["en", vi.fn()],
}));
vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/TurnstileWidget", () => ({
  default: () => <div data-testid="turnstile-stub" />,
}));
vi.mock("@/lib/meta-pixel", () => ({
  trackPixelEvent: vi.fn(),
}));
vi.mock("@/lib/fire-campaign-conversion", () => ({
  fireCampaignConversion: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ""} />,
}));

import ContactFormSection from "@/components/ContactFormSection";
import LinksPage from "@/app/links/page";

afterEach(cleanup);

describe("Nextcloud integration — contact form sidebar", () => {
  it("offers the Talk room link on the VIDEO CALL row", () => {
    render(<ContactFormSection source="test" />);
    expect(screen.getByText("VIDEO CALL:")).toBeTruthy();
    const talk = screen.getByRole("link", { name: /join a talk call/i });
    expect(talk.getAttribute("href")).toBe("/call");
  });

  it("keeps the video-call link in the same tab (internal /call route)", () => {
    render(<ContactFormSection source="test" />);
    const talk = screen.getByRole("link", { name: /join a talk call/i });
    expect(talk.getAttribute("target")).toBeNull();
  });
});

describe("Nextcloud integration — links page", () => {
  it("lists both self-hosted Nextcloud surfaces: Talk consult + workspace", async () => {
    render(await LinksPage());
    const consult = screen.getByRole("link", { name: /video call now/i });
    expect(consult.getAttribute("href")).toBe("/call");
    const workspace = screen.getByRole("link", { name: /client workspace/i });
    expect(workspace.getAttribute("href")).toBe("https://cloud.cloudless.gr");
  });

  it("opens the external Nextcloud workspace in a new tab without an opener handle", async () => {
    render(await LinksPage());
    const link = screen.getByRole("link", { name: /client workspace/i });
    expect(link.getAttribute("target")).toBe("_blank");
    const rel = link.getAttribute("rel") ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
  });
});
