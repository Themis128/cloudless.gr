// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// unstable_cache short-circuits outside a Next request scope, so the wrapped
// callbacks never ran under tests. Pass it through to exercise the real
// throw-on-failure-sentinels logic (a cached error must never be stored).
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      fn(...args),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ""} />,
}));
vi.mock("@/components/TurnstileWidget", () => ({
  default: () => <div data-testid="turnstile-stub" />,
}));

const mockCount = vi.fn<() => Promise<number | null>>();
vi.mock("@/lib/espocrm", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  countNewsletterSubscribers: () => mockCount(),
}));

const mockFeatured = vi.fn<() => Promise<unknown[]>>();
vi.mock("@/lib/appflowy-testimonials", () => ({
  getFeaturedTestimonials: () => mockFeatured(),
}));

import LinksPage from "@/app/links/page";

afterEach(() => {
  cleanup();
  mockCount.mockReset();
  mockFeatured.mockReset();
});

describe("links page — cached social proof", () => {
  it("hides the social-proof box when EspoCRM and AppFlowy are unavailable", async () => {
    // Failure sentinels: null count + empty testimonial list throw inside the
    // cached callbacks and degrade to 0 / [] — never a placeholder number.
    mockCount.mockResolvedValue(null);
    mockFeatured.mockResolvedValue([]);

    render(await LinksPage());

    expect(screen.queryByText(/builders/)).toBeNull();
    expect(screen.getByRole("link", { name: /cloudless\.gr/i })).toBeTruthy();
  });

  it("shows the live subscriber count and featured testimonial when available", async () => {
    mockCount.mockResolvedValue(137);
    mockFeatured.mockResolvedValue([
      {
        name: "Ada Lovelace",
        role: "CTO",
        company: "Acme SA",
        quote: "The stack runs itself.",
      },
    ]);

    render(await LinksPage());

    expect(screen.getByText("137+")).toBeTruthy();
    expect(screen.getByText(/The stack runs itself/)).toBeTruthy();
    expect(screen.getByText(/Ada Lovelace, CTO at Acme SA/)).toBeTruthy();
  });

  it("formats attribution without dangling commas when company is missing", async () => {
    mockCount.mockResolvedValue(0);
    mockFeatured.mockResolvedValue([
      { name: "Ada Lovelace", role: "CTO", quote: "Zero friction." },
    ]);

    render(await LinksPage());

    expect(screen.getByText(/Ada Lovelace, CTO$/)).toBeTruthy();
  });
});
