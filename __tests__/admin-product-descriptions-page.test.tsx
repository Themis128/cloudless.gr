/**
 * product-descriptions admin page — real product catalog, generate →
 * draft edit/select → apply flow, per-action error banners.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fetchWithAuthMock = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? "GET";
  if (method === "POST") {
    return okJson({
      results: [
        { id: "srv-cloud", name: "Cloud Architecture Audit", description: "Audit copy v1" },
        { id: "srv-growth", name: "AI Growth Engine", description: "Growth copy v1" },
      ],
      errors: [],
    });
  }
  if (method === "PUT") return okJson({ applied: 2 });
  return okJson({}, 404);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

import ProductDescriptionsPage from "@/app/[locale]/admin/product-descriptions/page";

const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};

describe("product-descriptions admin page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  beforeEach(() => {
    fetchWithAuthMock.mockClear();
  });

  it("uncheck products, generate drafts, edit/deselect, apply — success + error", async () => {
    const c = render(<ProductDescriptionsPage />).container;
    await act(async () => {});

    // real catalog renders; first checkbox is a real product
    const boxes = c.querySelectorAll('input[type="checkbox"]');
    expect(boxes.length).toBeGreaterThan(5);
    const first = boxes[0] as HTMLInputElement;
    expect(first.checked).toBe(true);
    fireEvent.click(first);
    expect(first.checked).toBe(false);

    // Clear → none selected → generate stays inert; Select all restores
    await click(screen.getByText("Clear"));
    expect((boxes[1] as HTMLInputElement).checked).toBe(false);
    await click(screen.getByText("Select all"));

    // generate → drafts render
    await click(screen.getByText(/Generate drafts/));
    expect(c.textContent).toContain("Generated 2 drafts");
    expect(c.textContent).toContain("Audit copy v1");

    // deselect second draft → only one applies
    const draftBoxes = Array.from(c.querySelectorAll('input[type="checkbox"]')).slice(-2);
    fireEvent.click(draftBoxes[1]);

    // edit first draft's textarea
    const ta = c.querySelector("textarea")!;
    fireEvent.change(ta, { target: { value: "Approved final copy" } });

    await click(screen.getByText(/Apply/));
    const put = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "PUT");
    const body = JSON.parse(String(put![1].body));
    expect(body.descriptions).toEqual([
      { id: "srv-cloud", description: "Approved final copy" },
    ]);
    expect(c.textContent).toContain("Applied 2 descriptions to product cache");

    // PUT failure → error banner
    fetchWithAuthMock.mockImplementationOnce(async () =>
      okJson({ error: "cache write failed" }, 500)
    );
    await click(screen.getByText(/Apply/));
    expect(c.textContent).toContain("cache write failed");
  });

  it("503 generate → not-configured state; !ok → error banner", async () => {
    fetchWithAuthMock.mockImplementationOnce(async () => okJson({}, 503));
    const c = render(<ProductDescriptionsPage />).container;
    await act(async () => {});
    await click(screen.getByText(/Generate drafts/));
    expect(c.textContent).toContain("is not configured for product copy");

    // !ok → error banner (fresh render — 503 replaces the whole page)
    cleanup();
    fetchWithAuthMock.mockImplementationOnce(async () =>
      okJson({ error: "ai exploded" }, 500)
    );
    const c2 = render(<ProductDescriptionsPage />).container;
    await act(async () => {});
    await click(screen.getByText(/Generate drafts/));
    expect(c2.textContent).toContain("ai exploded");
  });
});
