/**
 * Populated tests for admin docs list + admin email campaigns — grouped
 * categories, drafts toggle, populated campaign/list/automation rows,
 * and the error paths.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchMock = vi.fn();
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchMock(...args),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import AdminDocsPage from "@/app/[locale]/admin/docs/page";
import EmailCampaignsPage from "@/app/[locale]/admin/email/campaigns/page";

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function renderPage(el: React.ReactElement) {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(el).container;
  });
  return c!;
}

describe("admin docs — populated", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("groups docs by category and toggles drafts", async () => {
    fetchMock.mockResolvedValue(
      okJson({
        docs: [
          {
            id: "d1",
            title: "Setup Guide",
            slug: "setup-guide",
            category: "Guides",
            order: 1,
            published: true,
            description: "Get started",
          },
          {
            id: "d2",
            title: "Draft Notes",
            slug: "draft-notes",
            category: "Guides",
            order: 2,
            published: false,
          },
          {
            id: "d3",
            title: "Runbook",
            slug: "runbook",
            category: "Ops",
            order: 3,
            published: true,
          },
        ],
      })
    );
    const c = await renderPage(<AdminDocsPage />);
    expect(c.textContent).toContain("Setup Guide");
    expect(c.textContent).toContain("Draft Notes");
    expect(c.textContent).toContain("Runbook");
    expect(c.textContent).toContain("Guides");
    expect(c.textContent).toContain("Ops");
    expect(c.textContent).toContain("2 docs"); // Guides count
    expect(c.textContent).toContain("1 doc");

    // uncheck "Show drafts" → draft disappears
    const drafts = [...c.querySelectorAll("input[type='checkbox']")].find((i) =>
      i.closest("label")?.textContent?.includes("Show drafts")
    )!;
    await act(async () => fireEvent.click(drafts));
    expect(c.textContent).not.toContain("Draft Notes");
    expect(c.textContent).toContain("Setup Guide");
    expect(c.textContent).toContain("1 doc");
  });

  it("shows the error message on a failed load", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 502 }));
    const c = await renderPage(<AdminDocsPage />);
    expect(c.textContent).toContain("HTTP 502");
  });

  it("shows a network error when the fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("docs down"));
    const c = await renderPage(<AdminDocsPage />);
    expect(c.textContent).toContain("docs down");
  });
});

describe("admin email campaigns — populated", () => {
  function routeAll() {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("/stats")) return Promise.resolve(okJson({ totalSubscribers: 1280 }));
      if (u.includes("/lists"))
        return Promise.resolve(
          okJson({ lists: [{ id: "l1", name: "Newsletter", subscriber_count: "1042" }] })
        );
      if (u.includes("/automations"))
        return Promise.resolve(
          okJson({ automations: [{ id: "a1", name: "Welcome drip", status: "active" }] })
        );
      if (u.includes("/campaigns"))
        return Promise.resolve(
          okJson({
            campaigns: [
              {
                id: "c1",
                name: "October newsletter",
                subject: "What's new on the cluster",
                status: "sent",
                send_amt: "1010",
                uniqueopens: "412",
              },
            ],
          })
        );
      return Promise.resolve(okJson({}));
    });
  }

  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("renders populated campaigns, lists, and automations", async () => {
    routeAll();
    const c = await renderPage(<EmailCampaignsPage />);
    expect(c.textContent).toContain("1,280"); // subscriber total
    expect(c.textContent).toContain("October newsletter");
    expect(c.textContent).toContain("What's new on the cluster");
    expect(c.textContent).toContain("1,010"); // send_amt
    expect(c.textContent).toContain("412"); // unique opens
    expect(c.textContent).toContain("sent");
    expect(c.textContent).toContain("Newsletter");
    expect(c.textContent).toContain("1,042");
    expect(c.textContent).toContain("Welcome drip");
    expect(c.textContent).toContain("active");
  });

  it("shows the error message when a fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("ac api down"));
    const c = await renderPage(<EmailCampaignsPage />);
    expect(c.textContent).toContain("ac api down");
  });
});
