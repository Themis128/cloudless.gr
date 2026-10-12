/**
 * PlaybookLeadForm component + /api/cron/slack-digest route.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { NextRequest } from "next/server";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ── component mocks ───────────────────────────────────────────────────────────
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/TurnstileWidget", () => ({ default: () => null }));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en"] }));
vi.mock("@/lib/track-client-event", () => ({ trackClientEvent: vi.fn() }));

// ── route mocks ───────────────────────────────────────────────────────────────
const slackPost = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    channel = "";
    constructor(opts?: { channel?: string }) {
      this.channel = opts?.channel ?? "";
    }
    post = slackPost;
  },
}));
vi.mock("@/lib/stripe", () => ({
  listRecentCheckoutSessions: vi.fn(async () => ({ orders: [] })),
  formatPrice: (cents: number, cur: string) => `${(cents / 100).toFixed(2)} ${cur}`,
}));
vi.mock("@/lib/sentry", () => ({
  isSentryConfigured: vi.fn(async () => false),
  getErrorCounts: vi.fn(async () => ({ "24h": 0 })),
  getTopErrors: vi.fn(async () => []),
}));
vi.mock("@/lib/cron-auth", () => ({
  isCronAuthorized: vi.fn(async () => true),
  cronUnauthorized: () => Response.json({ error: "unauthorized" }, { status: 401 }),
}));

import PlaybookLeadForm from "@/components/PlaybookLeadForm";
import { listRecentCheckoutSessions } from "@/lib/stripe";
import { isSentryConfigured, getErrorCounts, getTopErrors } from "@/lib/sentry";
import { isCronAuthorized } from "@/lib/cron-auth";
import { GET } from "@/app/api/cron/slack-digest/route";

const req = () => new NextRequest("https://cloudless.gr/api/cron/slack-digest");

describe("PlaybookLeadForm", () => {
  const origFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = origFetch;
  });

  function fill(email = "lead@x.dev", consent = true) {
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: email },
    });
    if (consent)
      fireEvent.click(screen.getByRole("checkbox"));
  }

  it("blocks submit without consent and shows the consent error", async () => {
    render(<PlaybookLeadForm />);
    fill("lead@x.dev", false);
    fireEvent.submit(screen.getByRole("button", { name: /get|download|send|playbook/i }).closest("form")!);
    await waitFor(() =>
      expect(screen.getByText(/Please confirm you agree/i)).toBeTruthy()
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the lead and shows the email-delivery success", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, delivery: "email" }), { status: 200 })
    );
    render(<PlaybookLeadForm />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /get|download|send|playbook/i }).closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/playbook-lead", expect.anything()));
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body).toMatchObject({ email: "lead@x.dev", consent: true });
    await waitFor(() => expect(screen.getByText(/on its way to your inbox/i)).toBeTruthy());
  });

  it("shows the already-sent message for delivery=already_sent", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, delivery: "already_sent" }), { status: 200 })
    );
    render(<PlaybookLeadForm />);
    fill("dupe@x.dev");
    fireEvent.submit(screen.getByRole("button", { name: /get|download|send|playbook/i }).closest("form")!);
    await waitFor(() => expect(screen.getByText(/already received/i)).toBeTruthy());
  });

  it("renders a download link for delivery=download", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: true, delivery: "download", playbookUrl: "/pb.pdf" }),
        { status: 200 }
      )
    );
    render(<PlaybookLeadForm />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /get|download|send|playbook/i }).closest("form")!);
    await waitFor(() =>
      expect(screen.getAllByRole("link").some((a) => a.getAttribute("href") === "/pb.pdf")).toBe(true)
    );
  });

  it("shows a direct-download fallback on upstream_error and a generic message otherwise", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "no key", code: "upstream_error" }), { status: 502 })
    );
    render(<PlaybookLeadForm />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /get|download|send|playbook/i }).closest("form")!);
    await waitFor(() => expect(screen.getByText(/couldn't email the playbook/i)).toBeTruthy());
    expect(
      screen.getAllByRole("link").some((a) => a.getAttribute("href")?.includes("cloud-migration-playbook"))
    ).toBe(true);
    cleanup();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many", code: "RATE_LIMITED" }), { status: 429 })
    );
    render(<PlaybookLeadForm />);
    fill("r@x.dev");
    fireEvent.submit(screen.getByRole("button", { name: /get|download|send|playbook/i }).closest("form")!);
    await waitFor(() => expect(screen.getByText("Too many")).toBeTruthy());
  });
});

describe("cron slack-digest route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthorized callers", async () => {
    vi.mocked(isCronAuthorized).mockResolvedValueOnce(false);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(slackPost).not.toHaveBeenCalled();
  });

  it("posts a no-orders digest and the Sentry-unconfigured health check", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const texts = slackPost.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(texts.some((t) => t.includes("no orders yesterday"))).toBe(true);
    expect(texts.some((t) => t.includes("No Sentry integration configured"))).toBe(true);
  });

  it("aggregates paid orders from the last 24h with top-5 overflow", async () => {
    const now = Date.now();
    const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
    vi.mocked(listRecentCheckoutSessions).mockResolvedValueOnce({
      orders: [
        ...Array.from({ length: 7 }, (_, i) => ({
          id: `s${i}`,
          paymentStatus: "paid",
          created: iso(3600_000),
          amount: 100 * (i + 1),
          currency: "eur",
          customerEmail: `c${i}@x.dev`,
        })),
        { id: "old", paymentStatus: "paid", created: iso(200_000_000), amount: 999, currency: "eur" },
        { id: "unpaid", paymentStatus: "unpaid", created: iso(60_000), amount: 5, currency: "eur" },
      ],
    } as never);
    await GET(req());
    const orderMsg = slackPost.mock.calls
      .map((c) => c[0] as { text?: string; blocks?: { text?: { text: string } }[] })
      .find((p) => p.text?.includes("7 orders"));
    expect(orderMsg).toBeTruthy();
    const json = JSON.stringify(orderMsg);
    expect(json).toContain("28.00 eur"); // 100+200+...+700 cents = 2800
    expect(json).toContain("and 2 more orders"); // 7 - 5 shown
    expect(json).not.toContain("c5@x.dev"); // only top 5 emails shown
  });

  it("posts Sentry error counts and top issues when configured", async () => {
    vi.mocked(isSentryConfigured).mockResolvedValueOnce(true);
    vi.mocked(getErrorCounts).mockResolvedValueOnce({ "24h": 3, "1h": 1 } as never);
    vi.mocked(getTopErrors).mockResolvedValueOnce([
      { title: "TypeError <oops>", permalink: "https://sentry.io/i/1", count: "2", level: "error" },
    ] as never);
    await GET(req());
    const errMsg = slackPost.mock.calls
      .map((c) => JSON.stringify(c[0]))
      .find((t) => t.includes("sentry.io"));
    expect(errMsg).toBeTruthy();
    expect(errMsg).toContain("&lt;oops&gt;"); // slackEscape
    expect(errMsg).toContain("2 events");
  });

  it("returns 500 when a digest throws", async () => {
    vi.mocked(listRecentCheckoutSessions).mockRejectedValueOnce(new Error("stripe down"));
    const res = await GET(req());
    expect(res.status).toBe(500);
  });
});
