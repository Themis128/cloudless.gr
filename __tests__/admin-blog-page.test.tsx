/**
 * admin/blog — populated list, published/draft filters, tag render, errors.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: fetchWithAuthMock }));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));

import BlogAdminPage from "@/app/[locale]/admin/blog/page";

const okJson = (b: unknown) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const posts = [
  {
    id: "p1",
    slug: "post-one",
    title: "Published Post",
    excerpt: "e",
    date: "2026-01-10",
    author: "Themis",
    category: "Cloud",
    tags: ["aws", "cf", "edge"],
    published: true,
    featured: false,
    readTime: "5 min",
  },
  {
    id: "p2",
    slug: "post-two",
    title: "Draft Post",
    excerpt: "e",
    date: "2026-01-12",
    author: "Themis",
    category: "AI",
    tags: ["llm"],
    published: false,
    featured: true,
    readTime: "3 min",
  },
];

describe("admin blog", () => {
  it("lists posts with dates + tags and filters published/draft", async () => {
    fetchWithAuthMock.mockResolvedValue(okJson({ posts }));
    const { container, queryByText } = render(<BlogAdminPage />);
    await waitFor(() => expect(container.textContent).toContain("Published Post"));
    expect(container.textContent).toContain("Draft Post");
    expect(container.textContent).toContain("aws");

    const filterBtn = (label: string) =>
      [...container.querySelectorAll("button")].find((b) =>
        b.textContent?.startsWith(label)
      )!;
    await act(async () => fireEvent.click(filterBtn("Published")));
    expect(queryByText("Draft Post")).toBeNull();
    expect(container.textContent).toContain("Published Post");

    await act(async () => fireEvent.click(filterBtn("Draft")));
    expect(queryByText("Published Post")).toBeNull();
    expect(container.textContent).toContain("Draft Post");
  });

  it("shows the error message on failure", async () => {
    fetchWithAuthMock.mockResolvedValue(new Response("x", { status: 500 }));
    const { container } = render(<BlogAdminPage />);
    await waitFor(() => expect(container.textContent).toContain("HTTP 500"));
  });
});
