/**
 * Component tails — NewsletterForm submit paths, StatCounter lazy countup,
 * HolographicCard pointer transforms.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("@/components/TurnstileWidget", () => ({ default: () => null }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import NewsletterForm from "@/components/NewsletterForm";
import StatCounter from "@/components/StatCounter";
import HolographicCard from "@/components/HolographicCard";

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ── NewsletterForm ──────────────────────────────────────────────────────────

describe("NewsletterForm", () => {
  const fill = (c: HTMLElement, email: string) =>
    fireEvent.change(c.querySelector("input[type='email']")!, {
      target: { value: email },
    });

  it("success shows the message, clears the email, calls onSuccess", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const onSuccess = vi.fn();
    const { container } = render(<NewsletterForm onSuccess={onSuccess} />);
    await act(async () => fill(container, "a@b.gr"));
    await act(async () =>
      fireEvent.submit(container.querySelector("form")!)
    );
    expect(container.textContent).toContain("Check your email");
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(
      (container.querySelector("input[type='email']") as HTMLInputElement).value
    ).toBe("");
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/subscribe");
  });

  it("API error shows the server error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "already subscribed" }), { status: 400 })
      )
    );
    const { container } = render(<NewsletterForm />);
    await act(async () => fill(container, "a@b.gr"));
    await act(async () => fireEvent.submit(container.querySelector("form")!));
    expect(container.textContent).toContain("already subscribed");
  });

  it("non-JSON error body falls back to the generic message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad gateway", { status: 502 }))
    );
    const { container } = render(<NewsletterForm />);
    await act(async () => fill(container, "a@b.gr"));
    await act(async () => fireEvent.submit(container.querySelector("form")!));
    expect(container.textContent).toContain("Something went wrong");
  });

  it("network throw shows the generic error; empty email never posts", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<NewsletterForm />);
    // empty email → guard returns before fetch
    await act(async () => fireEvent.submit(container.querySelector("form")!));
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => fill(container, "a@b.gr"));
    await act(async () => fireEvent.submit(container.querySelector("form")!));
    expect(container.textContent).toContain("Something went wrong");
  });
});

// ── StatCounter ─────────────────────────────────────────────────────────────

describe("StatCounter", () => {
  it("lazy-loads countup when the element scrolls into view", async () => {
    let trigger: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    class FakeIO {
      constructor(cb: IntersectionObserverCallback) {
        trigger = (entries) => cb(entries as IntersectionObserverEntry[], this as never);
      }
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
      takeRecords = () => [];
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    vi.stubGlobal("IntersectionObserver", FakeIO);

    const { container, unmount } = render(<StatCounter value="99.9%" label="uptime" />);
    expect(observe).toHaveBeenCalledOnce();

    await act(async () => {
      trigger!([{ isIntersecting: true }]);
      // let the dynamic import('countup.js') resolve
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(unobserve).toHaveBeenCalledOnce();

    // second intersection is ignored — the started flag is latched
    await act(async () => {
      trigger!([{ isIntersecting: true }]);
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(unobserve).toHaveBeenCalledOnce();

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("renders plain text when IntersectionObserver is unavailable", async () => {
    const orig = globalThis.IntersectionObserver;
    // @ts-expect-error simulate a browser without IO
    delete globalThis.IntersectionObserver;
    const { container } = render(<StatCounter value="42+" label="projects" />);
    expect(container.textContent).toContain("42+");
    expect(container.textContent).toContain("projects");
    globalThis.IntersectionObserver = orig;
  });
});

// ── HolographicCard ─────────────────────────────────────────────────────────

describe("HolographicCard", () => {
  it("tilts on mousemove and resets on mouseleave", async () => {
    const { container } = render(
      <HolographicCard>
        <div>card body</div>
      </HolographicCard>
    );
    const card = container.firstElementChild as HTMLElement;
    const glare = card.querySelector("div.pointer-events-none") as HTMLElement;

    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    await act(async () =>
      fireEvent.mouseMove(card, { clientX: 150, clientY: 75 })
    );
    expect(card.style.transform).toContain("perspective(800px)");
    expect(card.style.transform).toContain("scale3d(1.02");
    expect(glare.style.opacity).toBe("1");
    expect(glare.style.background).toContain("linear-gradient");

    await act(async () => fireEvent.mouseLeave(card));
    expect(card.style.transform).toContain("rotateX(0deg)");
    expect(glare.style.opacity).toBe("0");
  });
});
