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

describe("admin socialauto gate page — edge paths", () => {
  it("reject removes the item", async () => {
    stubFetch();
    await act(async () => { render(<SocialAutoGatePage />); });
    await screen.findByText("@Ana");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button").find(b => /reject/i.test(b.textContent || ""))!);
    });
    expect(screen.queryByText("@Ana")).toBeNull();
  });

  it("shows error when action fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: unknown, init?: RequestInit) =>
      new Response(JSON.stringify(
        String(u).includes("socialauto-gates") && (!init || init.method !== "POST")
          ? { items: ITEMS } : { error: "boom" }),
        { status: String(u).includes("socialauto-gates") && init?.method === "POST" ? 500 : 200,
          headers: { "Content-Type": "application/json" } })));
    await act(async () => { render(<SocialAutoGatePage />); });
    await screen.findByText("@Ana");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button").find(b => /approve/i.test(b.textContent || ""))!);
    });
    await screen.findByText(/failed/i);
  });

  it("shows error when load fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } })));
    await act(async () => { render(<SocialAutoGatePage />); });
    await screen.findByText(/error|fail/i);
  });

  it("renders empty state when no items", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ items: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } })));
    await act(async () => { render(<SocialAutoGatePage />); });
    await act(async () => {});
    expect(screen.queryByText("@Ana")).toBeNull();
  });

  it("keyboard arrows + space approve selected item", async () => {
    stubFetch();
    await act(async () => { render(<SocialAutoGatePage />); });
    await screen.findByText("@Ana");
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "ArrowDown" });
      fireEvent.keyDown(document.body, { key: "ArrowUp" });
      fireEvent.keyDown(document.body, { key: " " });
    });
    expect(screen.queryByText("@Ana")).toBeNull();
  });

  it("backspace rejects selected item", async () => {
    stubFetch();
    await act(async () => { render(<SocialAutoGatePage />); });
    await screen.findByText("@Ana");
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "Backspace" });
    });
    expect(screen.queryByText("@Ana")).toBeNull();
  });
});

describe("admin socialauto gate page — keyboard guards", () => {
  it("ignores keys while typing in the textarea", async () => {
    stubFetch();
    await act(async () => { render(<SocialAutoGatePage />); });
    await screen.findByText("@Ana");
    const ta = screen.getByRole("textbox");
    await act(async () => {
      fireEvent.keyDown(ta, { key: "ArrowDown" });
      fireEvent.keyDown(ta, { key: " " });
      fireEvent.keyDown(ta, { key: "Backspace" });
    });
    // item must still be present — keys were typed inside the textarea
    expect(screen.getByText("@Ana")).toBeTruthy();
  });

  it("ignores keys when no items are loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ items: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } })));
    await act(async () => { render(<SocialAutoGatePage />); });
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "ArrowDown" });
      fireEvent.keyDown(document.body, { key: " " });
    });
    expect(screen.queryByText("@Ana")).toBeNull();
  });

  it("clicking a card selects it", async () => {
    stubFetch();
    const { container } = await act(async () => render(<SocialAutoGatePage />));
    await screen.findByText("@Ana");
    await act(async () => {
      fireEvent.click(screen.getByText("@Ana").closest("div[class*='rounded-xl']")!);
    });
    expect(container.querySelector(".border-neon-cyan\\/60, [class*='neon-cyan']")).toBeTruthy();
  });
});
