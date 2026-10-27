/** @vitest-environment jsdom */
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const ITEMS = [
  { id: "g1", platform: "linkedin", target_author: "Ana", action: "comment",
    score: 0.9, comment_draft: "Nice post", status: "pending_human_gate" },
];

function stubFetch() {
  vi.stubGlobal("fetch", vi.fn(async (u: unknown, init?: RequestInit) =>
    new Response(JSON.stringify(
      String(u).includes("socialauto-gates") && (!init || init.method !== "POST")
        ? { items: ITEMS } : { item: { id: "g1", status: "approved" } }),
      { status: 200, headers: { "Content-Type": "application/json" } })));
}

import SocialAutoGatePage from "@/app/[locale]/admin/socialauto/page";

afterEach(cleanup);

describe("admin socialauto gate page", () => {
  it("loads and renders pending items", async () => {
    stubFetch();
    await act(async () => { render(<SocialAutoGatePage />); });
    await screen.findByText("@Ana");
    expect(screen.getByText(/linkedin/i)).toBeTruthy();
  });

  it("approve removes the item", async () => {
    stubFetch();
    await act(async () => { render(<SocialAutoGatePage />); });
    await screen.findByText("@Ana");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button").find(b => /approve/i.test(b.textContent || ""))!);
    });
    expect(screen.queryByText("@Ana")).toBeNull();
  });
});
