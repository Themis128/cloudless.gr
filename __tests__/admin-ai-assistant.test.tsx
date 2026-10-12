/**
 * Populated-state interaction tests for the AI Campaign Assistant page —
 * chat loop (toolsUsed, 503/error), RAG sync, strategy + copy forms, tabs.
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

let routes: Record<string, unknown> = {};
const fetchWithAuthMock = vi.fn(async (url: string, init?: RequestInit) => {
  const out = routes[String(url)];
  if (typeof out === "function") return out(init);
  if (out instanceof Response) return out;
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

vi.mock("@/components/admin/AdminAiUsageCard", () => ({
  default: () => <div data-testid="usage-card" />,
}));

import AIAssistantPage from "@/app/[locale]/admin/ai-assistant/page";

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<AIAssistantPage />).container;
  });
  return c!;
}
const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};
const submit = async (el: HTMLFormElement) => {
  await act(async () => fireEvent.submit(el));
};

describe("ai-assistant — populated interactions", () => {
  beforeEach(() => {
    routes = {};
    fetchWithAuthMock.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("chat — send message, toolsUsed badge, 503 + error + empty guard", async () => {
    const c = await renderPage();
    expect(c.textContent).toContain("Ask me anything");

    const form = c.querySelector("form") as HTMLFormElement;
    const input = form.querySelector("input") as HTMLInputElement;

    // empty input → disabled send
    expect((form.querySelector("button") as HTMLButtonElement).disabled).toBe(true);

    // success with toolsUsed
    routes["/api/admin/ai/assistant"] = {
      response: "Found 3 docs",
      toolsUsed: ["search_docs", "lake_query"],
    };
    fireEvent.change(input, { target: { value: "hi" } });
    await submit(form);
    expect(c.textContent).toContain("hi");
    expect(c.textContent).toContain("Found 3 docs");
    expect(c.textContent).toContain("Used: search_docs, lake_query");
    const body = JSON.parse(
      String(fetchWithAuthMock.mock.calls.find(([u]) => String(u).includes("assistant"))![1].body)
    );
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);

    // 503 → configured error
    routes["/api/admin/ai/assistant"] = okJson({}, 503);
    fireEvent.change(input, { target: { value: "q2" } });
    await submit(form);
    expect(c.textContent).toContain("Admin AI is not configured");

    // 500 → generic error
    routes["/api/admin/ai/assistant"] = okJson({}, 500);
    fireEvent.change(input, { target: { value: "q3" } });
    await submit(form);
    expect(c.textContent).toContain("Assistant request failed");

    // throw → catch
    routes["/api/admin/ai/assistant"] = () => Promise.reject(new Error("boom"));
    fireEvent.change(input, { target: { value: "q4" } });
    await submit(form);
    expect(c.textContent).toContain("boom");
  });

  it("rag sync — success appends message; error shows", async () => {
    const c = await renderPage();
    routes["/api/admin/ai/rag/sync"] = { upserted: 42 };
    await click(screen.getByText("Sync AppFlowy → Vectorize RAG"));
    expect(c.textContent).toContain("Synced 42 AppFlowy chunks");

    routes["/api/admin/ai/rag/sync"] = okJson({ error: "vectorize down" }, 500);
    await click(screen.getByText("Sync AppFlowy → Vectorize RAG"));
    expect(c.textContent).toContain("vectorize down");
  });

  it("strategy — form fields, result card, errors", async () => {
    const c = await renderPage();
    await click(screen.getByText("Campaign Strategy"));

    const form = c.querySelector("form") as HTMLFormElement;
    fireEvent.change(form.querySelector("textarea")!, { target: { value: "promote X" } });
    fireEvent.change(form.querySelector("#budget")!, { target: { value: "€500" } });
    fireEvent.change(form.querySelector("#targetAudience")!, { target: { value: "SMBs" } });

    routes["/api/admin/ai/campaign"] = { strategy: "do stuff" };
    await submit(form);
    expect(c.textContent).toContain("Strategy");
    const body = JSON.parse(
      String(fetchWithAuthMock.mock.calls.find(([u]) => String(u).includes("campaign"))![1].body)
    );
    expect(body).toEqual({ brief: "promote X", budget: "€500", targetAudience: "SMBs" });

    // error path
    routes["/api/admin/ai/campaign"] = okJson({}, 500);
    await submit(form);
    expect(c.textContent).toContain("Failed to generate strategy");
    // throw
    routes["/api/admin/ai/campaign"] = () => Promise.reject(new Error("net"));
    await submit(form);
    expect(c.textContent).toContain("net");
  });

  it("copy — selects, variants render, error", async () => {
    const c = await renderPage();
    await click(screen.getByText("Ad Copy"));

    const form = c.querySelector("form") as HTMLFormElement;
    fireEvent.change(form.querySelector("#service")!, { target: { value: "svc" } });
    fireEvent.change(form.querySelector("#platform")!, { target: { value: "TikTok" } });
    fireEvent.change(form.querySelector("#objective")!, { target: { value: "conversions" } });
    fireEvent.change(form.querySelector("#language")!, { target: { value: "Greek" } });

    routes["/api/admin/ai/copy"] = {
      variants: { variants: ["var-one", "var-two"] },
    };
    await submit(form);
    // variants render as cards (text lands in id/text fields; headline/body/cta empty)
    expect(c.textContent).toContain("Variant 1");
    expect(c.textContent).toContain("Variant 2");
    const body = JSON.parse(
      String(fetchWithAuthMock.mock.calls.find(([u]) => String(u).includes("ai/copy"))![1].body)
    );
    expect(body).toMatchObject({
      service: "svc",
      platform: "TikTok",
      objective: "conversions",
      language: "Greek",
    });

    routes["/api/admin/ai/copy"] = okJson({}, 503);
    await submit(form);
    expect(c.textContent).toContain("Admin AI is not configured");
  });
});

describe("ai-assistant — remaining tails", () => {
  afterEach(() => {
    cleanup();
  });

  it("strategy renders structured platform/budget/headline sections", async () => {
    const c = await renderPage();
    await click(screen.getByText("Campaign Strategy"));
    const form = c.querySelector("form") as HTMLFormElement;
    fireEvent.change(form.querySelector("textarea")!, { target: { value: "b" } });

    routes["/api/admin/ai/campaign"] = {
      strategy: {
        campaign_objective: "Awareness",
        recommended_platforms: ["linkedin", "meta"],
        budget_split: { linkedin: 60, meta: 40 },
        timeline: "4 weeks",
        copy_suggestions: { headline: ["Save big", "Move to cloud"] },
      },
    };
    await submit(form);
    expect(c.textContent).toContain("Recommended Platforms");
    expect(c.textContent).toContain("linkedin");
    expect(c.textContent).toContain("Budget Split");
    expect(c.textContent).toContain("60%");
    expect(c.textContent).toContain("Headline Suggestions");
    expect(c.textContent).toContain("1. Save big");
    expect(c.textContent).toContain("4 weeks");

    // 503 → not-configured guidance
    routes["/api/admin/ai/campaign"] = okJson({}, 503);
    await submit(form);
    expect(c.textContent).toContain("Admin AI is not configured");
  });

  it("copy surfaces a rejected fetch as the error message", async () => {
    const c = await renderPage();
    await click(screen.getByText("Ad Copy"));
    const form = c.querySelector("form") as HTMLFormElement;
    routes["/api/admin/ai/copy"] = () => Promise.reject(new Error("copy api down"));
    await submit(form);
    expect(c.textContent).toContain("copy api down");

    // 503 → not-configured guidance
    routes["/api/admin/ai/copy"] = okJson({}, 503);
    await submit(form);
    expect(c.textContent).toContain("Admin AI is not configured");
  });

  it("strategy renders the raw text fallback when the model emits non-JSON", async () => {
    const c = await renderPage();
    await click(screen.getByText("Campaign Strategy"));
    const form = c.querySelector("form") as HTMLFormElement;
    fireEvent.change(form.querySelector("textarea")!, { target: { value: "b" } });
    routes["/api/admin/ai/campaign"] = {
      strategy: { raw: "Phase 1: audit. Phase 2: launch." },
    };
    await submit(form);
    expect(c.textContent).toContain("Phase 1: audit. Phase 2: launch.");
  });
});
