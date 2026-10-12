/**
 * admin automation — n8n health/workflows/executions, filters, trigger tails.
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

import AutomationPage from "@/app/[locale]/admin/automation/page";

const okJson = (b: unknown) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const health = {
  ok: true,
  configured: true,
  latencyMs: 42,
  workflows: { total: 2, active: 1 },
  executions: { recent: 3, errors: 1, running: 0 },
};
const workflows = [
  {
    id: "wf1",
    name: "Carousel Publisher",
    active: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-02",
    tags: [{ id: "t1", name: "social" }],
  },
  {
    id: "wf2",
    name: "Daily Digest",
    active: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-02",
  },
];
const executions = [
  {
    id: "e1",
    finished: true,
    mode: "trigger",
    startedAt: "2026-01-02T00:00:00Z",
    stoppedAt: "2026-01-02T00:01:00Z",
    workflowId: "wf1",
    status: "success",
  },
  {
    id: "e2",
    finished: false,
    mode: "webhook",
    startedAt: "2026-01-02T01:00:00Z",
    stoppedAt: null,
    workflowId: "wf2",
    status: "error",
  },
];

const routeAll = async (url: string, init?: RequestInit) => {
  const u = String(url);
  if (u.includes("/health")) return okJson(health);
  if (u.includes("/executions")) return okJson({ executions });
  if (u.includes("/trigger"))
    return init?.method === "POST" ? okJson({ ok: true }) : new Response("x", { status: 405 });
  return okJson({ workflows });
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("admin automation", () => {
  it("loads health + workflows + executions, filters, triggers", async () => {
    fetchWithAuthMock.mockImplementation(routeAll);
    const { container } = render(<AutomationPage />);
    await waitFor(() => expect(container.textContent).toContain("Carousel Publisher"));
    expect(container.textContent).toContain("Daily Digest");
    expect(container.textContent).toContain("social");

    // executions rendered (status text)
    expect(container.textContent).toMatch(/success|error/i);

    // active-only filter hides the inactive workflow
    const pill = (t: string) =>
      [...container.querySelectorAll("button")].find(
        (b) => (b.textContent ?? "").trim() === t
      )!;
    const triggerButtons = () =>
      [...container.querySelectorAll("button")].filter((b) =>
        /trigger/i.test(b.textContent ?? "")
      );
    await act(async () => fireEvent.click(pill("Active")));
    await waitFor(() => expect(triggerButtons().length).toBe(1));
    await act(async () => fireEvent.click(pill("Inactive")));
    await waitFor(() => expect(triggerButtons().length).toBe(1));
    await act(async () => fireEvent.click(pill("All")));
    await waitFor(() => expect(triggerButtons().length).toBe(2));

    // trigger wf1 → POST + success message
    const triggerBtn = [...container.querySelectorAll("button")].find((b) =>
      /trigger|run/i.test(b.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(triggerBtn));
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(([u]) => String(u).includes("/trigger"))
      ).toBe(true)
    );
    await waitFor(() => expect(container.textContent).toContain("triggered successfully"));
  });

  it("surfaces trigger failure", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/trigger"))
        return new Response(JSON.stringify({ error: "n8n offline" }), { status: 502 });
      return routeAll(url, init);
    });
    const { container } = render(<AutomationPage />);
    await waitFor(() => expect(container.textContent).toContain("Carousel Publisher"));
    const triggerBtn = [...container.querySelectorAll("button")].find((b) =>
      /trigger|run/i.test(b.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(triggerBtn));
    await waitFor(() => expect(container.textContent).toContain("n8n offline"));
  });

  it("renders empty state when n8n is unconfigured", async () => {
    fetchWithAuthMock.mockResolvedValue(new Response("x", { status: 503 }));
    const { container } = render(<AutomationPage />);
    await waitFor(() =>
      expect(container.textContent).toMatch(/no workflow|not configured|empty|n8n/i)
    );
  });
});
