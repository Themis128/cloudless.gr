/**
 * /consultation landing page — async RSC render + generateMetadata.
 * Server/client seams stubbed; ConsultationBooking has its own suite
 * (consultation-booking.test.tsx).
 *
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/server-locale", () => ({ getServerLocale: vi.fn(async () => "en") }));
vi.mock("@/components/JsonLd", () => ({ default: () => null }));
vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/app/[locale]/consultation/ConsultationBooking", () => ({
  default: () => <div data-testid="booking-widget">BOOKING</div>,
}));

import ConsultationPage, { generateMetadata } from "@/app/[locale]/consultation/page";

const sp = (params: Record<string, unknown> = {}) =>
  Promise.resolve(params) as Promise<Record<string, unknown>>;

afterEach(() => cleanup());

describe("consultation page", () => {
  it("renders hero, steps sidebar, mailto fallback and the booking widget", async () => {
    const { container, getByTestId } = render(await ConsultationPage());
    expect(container.textContent).toMatch(/Book your free consultation/);
    expect(container.textContent).toMatch(/Pick a slot/);
    expect(container.textContent).toMatch(/Leave with a plan/);
    expect(container.textContent).toContain("tbaltzakis@cloudless.gr");
    expect(getByTestId("booking-widget")).toBeTruthy();
  });

  it("generateMetadata emits localized canonical + og tags", async () => {
    const meta = await generateMetadata({ params: sp({ locale: "en" }) });
    expect(String(meta.title)).toContain("Consultation");
    expect(meta.alternates?.canonical).toBe("https://cloudless.gr/en/consultation");
    expect(meta.alternates?.languages?.el).toBe("https://cloudless.gr/el/consultation");
    expect(meta.openGraph?.url).toBe("https://cloudless.gr/consultation");
  });

  it("generateMetadata falls back to en on an unsupported locale", async () => {
    const meta = await generateMetadata({ params: sp({ locale: "xx" }) });
    expect(meta.alternates?.canonical).toBe("https://cloudless.gr/en/consultation");
  });
});
