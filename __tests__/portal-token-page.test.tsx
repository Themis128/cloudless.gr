/**
 * Populated-state tests for the public client portal page
 * /portal/[token] — load/error states, step timeline expand + reply,
 * deliverable approve/request-changes, payment badges + pay links,
 * subscriptions, projects, invoices.
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
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.url;
  const method = init?.method ?? "GET";
  const out = routes[`${method} ${url}`] ?? routes[url];
  if (typeof out === "function") return out(init);
  if (out instanceof Response) return out;
  if (out === undefined) return new Response(JSON.stringify({ error: "nf" }), { status: 404 });
  return okJson(out);
});

import PortalPage from "@/app/portal/[token]/page";

const renderPage = async () => {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<PortalPage params={Promise.resolve({ token: "tok1" })} />).container;
  });
  return c!;
};

const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};

const DATA = {
  client: { name: "Acme Co", email: "a@acme.co", label: "Cloud Migration" },
  steps: [
    {
      id: "s1",
      name: "Kickoff",
      status: "completed",
      completedAt: new Date(Date.now() - 3 * 864e5).toISOString(),
      comments: [
        {
          id: "c1",
          author: "PM",
          text: "done",
          createdAt: new Date(Date.now() - 3600e3).toISOString(),
        },
      ],
    },
    { id: "s2", name: "Build", status: "in-progress", comments: [] },
    { id: "s3", name: "Blocked step", status: "blocked", comments: [] },
    { id: "s4", name: "Ship", status: "pending", comments: [] },
  ],
  deliverables: [
    {
      id: "d1",
      title: "Design",
      url: "https://f.example/d",
      description: "figma",
      status: "in_review",
    },
    { id: "d2", title: "Report", status: "approved", clientComment: "thanks" },
    { id: "d3", title: "Fix", status: "changes_requested", clientComment: "pls change" },
  ],
  paymentLinks: [
    {
      id: "p1",
      label: "Deposit",
      url: "https://pay/x",
      amountCents: 5000,
      currency: "EUR",
      status: "open",
    },
    { id: "p2", label: "Balance", url: "https://pay/y", status: "paid" },
    { id: "p3", label: "Voided", url: "https://pay/z", status: "void" },
  ],
  projects: [{ id: "pr1", name: "Migration", status: "active", progress: 55 }],
  invoices: [
    {
      id: "in_1234567890",
      number: "INV-1",
      amount: 50000,
      currency: "EUR",
      status: "paid",
      created: 1735689600,
      pdfUrl: "https://pdf/1",
    },
    {
      id: "in_abcd",
      number: null,
      amount: 100,
      currency: "EUR",
      status: "paid",
      created: 1735689600,
      pdfUrl: null,
    },
  ],
  subscriptions: [
    {
      id: "sub1",
      status: "active",
      planName: "Cloud Plan",
      amount: 9900,
      currency: "EUR",
      interval: "mo",
      currentPeriodEnd: 1767225600,
      cancelAtPeriodEnd: false,
    },
    {
      id: "sub2",
      status: "trialing",
      planName: "Trial",
      amount: 0,
      currency: "EUR",
      interval: "mo",
      currentPeriodEnd: 1767225600,
      cancelAtPeriodEnd: true,
    },
    {
      id: "sub3",
      status: "past_due",
      planName: "Old",
      amount: 500,
      currency: "EUR",
      interval: "mo",
      currentPeriodEnd: 1767225600,
      cancelAtPeriodEnd: false,
    },
  ],
};

describe("portal/[token] page — populated interactions", () => {
  beforeEach(() => {
    routes = {};
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("404 → revoked error; 500 → generic error", async () => {
    let c = await renderPage();
    expect(c.textContent).toContain("invalid or has been revoked");
    cleanup();

    routes["GET /api/portal/tok1"] = new Response("x", { status: 500 });
    c = await renderPage();
    expect(c.textContent).toContain("Failed to load your portal");
  });

  it("renders all sections: steps, deliverables, payments, subs, projects, invoices", async () => {
    routes["GET /api/portal/tok1"] = DATA;
    const c = await renderPage();
    expect(c.textContent).toContain("Acme Co");
    expect(c.textContent).toContain("Cloud Migration");
    expect(c.textContent).toContain("1/4 steps");
    expect(c.textContent).toContain("25%");

    // deliverables badges
    expect(c.textContent).toContain("Awaiting your review");
    expect(c.textContent).toContain("Changes requested");
    expect(c.textContent).toContain("Your feedback: thanks");

    // payments — void filtered out, open shows Pay now
    expect(c.textContent).toContain("Deposit");
    expect(c.textContent).toContain("Pay now →");
    expect(c.textContent).not.toContain("Voided");

    // subscriptions — three badge variants + Cancels/Renews
    expect(c.textContent).toContain("Cloud Plan");
    expect(c.textContent).toContain("trialing");
    expect(c.textContent).toContain("past_due");
    expect(c.textContent).toContain("Cancels");
    expect(c.textContent).toContain("Renews");

    // projects + invoices (number fallback to id slice, pdf link)
    expect(c.textContent).toContain("Migration");
    expect(c.textContent).toContain("55%");
    expect(c.textContent).toContain("INV-1");
    expect(c.textContent).toContain("in_abcd"); // id.slice(0,12)
    expect(c.querySelector("a[href='https://pdf/1']")).toBeTruthy();
  });

  it("step expand/collapse, comments render, reply posts", async () => {
    routes["GET /api/portal/tok1"] = DATA;
    routes["POST /api/portal/tok1/comments"] = okJson({
      comment: {
        id: "c-new",
        author: "Client",
        text: "my reply",
        createdAt: new Date().toISOString(),
      },
    });
    const c = await renderPage();

    // in-progress step s2 auto-expanded → "No updates" + reply form
    expect(c.textContent).toContain("No updates yet for this step.");
    // s1 comment visible? s1 not expanded — expand it
    const rows = c.querySelectorAll("button[aria-expanded]");
    // find the row whose text contains "Kickoff"
    const kickoff = Array.from(rows).find((b) => b.textContent?.includes("Kickoff"))!;
    await click(kickoff);
    expect(c.textContent).toContain("done");
    expect(c.textContent).toContain("PM");

    // reply on s1 — textarea + send
    const reply = c.querySelector("input[placeholder='Write a reply...']") as HTMLInputElement;
    fireEvent.change(reply, { target: { value: "my reply" } });
    fireEvent.submit(reply.closest("form")!);
    await act(async () => {});
    const postCall = fetchMock.mock.calls.find(
      ([u, i]) => String(u).includes("comments") && i?.method === "POST"
    );
    expect(JSON.parse(String(postCall![1].body))).toMatchObject({ stepId: "s1", text: "my reply" });
    // onSent pushes into the step object + setExpanded(same-id) bails, so the
    // parent list doesn't re-render — collapse + re-expand shows the reply.
    await click(kickoff);
    await click(kickoff);
    expect(c.textContent).toContain("my reply");
  });

  it("deliverable approve + request-changes flow + error", async () => {
    routes["GET /api/portal/tok1"] = DATA;
    routes["POST /api/portal/tok1/deliverables"] = okJson({
      deliverable: { id: "d1", title: "Design", status: "approved", clientComment: "" },
    });
    const c = await renderPage();

    // approve
    await click(screen.getByText("Approve ✓"));
    const approveCall = fetchMock.mock.calls.find(
      ([u, i]) => String(u).includes("deliverables") && i?.method === "POST"
    );
    expect(JSON.parse(String(approveCall![1].body))).toMatchObject({
      deliverableId: "d1",
      action: "approve",
    });
    // status updated → badge flips
    expect(c.textContent).not.toContain("Awaiting your review");

    // request changes on a fresh in_review deliverable — need another fixture
    routes["GET /api/portal/tok1"] = {
      ...DATA,
      deliverables: [{ id: "d9", title: "Doc", status: "in_review" }],
    };
    cleanup();
    const c2 = await renderPage();
    await click(screen.getByText("Request changes"));
    const area = c2.querySelector(
      "textarea[placeholder*='What would you like']"
    ) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: "needs work" } });
    routes["POST /api/portal/tok1/deliverables"] = okJson({
      deliverable: {
        id: "d9",
        title: "Doc",
        status: "changes_requested",
        clientComment: "needs work",
      },
    });
    await click(screen.getByText("Send change request"));
    const reqCall = fetchMock.mock.calls
      .filter(([u, i]) => String(u).includes("deliverables") && i?.method === "POST")
      .pop();
    expect(JSON.parse(String(reqCall![1].body))).toMatchObject({
      action: "request_changes",
      comment: "needs work",
    });
    expect(c2.textContent).toContain("Changes requested");

    // error path
    cleanup();
    routes["GET /api/portal/tok1"] = {
      ...DATA,
      deliverables: [{ id: "d8", title: "D8", status: "in_review" }],
    };
    routes["POST /api/portal/tok1/deliverables"] = okJson({ error: "bad input" }, 400);
    const c3 = await renderPage();
    await click(screen.getByText("Approve ✓"));
    expect(c3.textContent).toContain("bad input");

    // network throw path
    routes["POST /api/portal/tok1/deliverables"] = () => Promise.reject(new Error("net"));
    await click(screen.getByText("Approve ✓"));
    expect(c3.textContent).toContain("Could not reach the server");
  });
});

describe("portal/[token] — residual branches", () => {
  beforeEach(() => {
    routes = {};
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders long-form date for comments older than a week", async () => {
    routes["GET /api/portal/tok1"] = {
      ...DATA,
      steps: [
        {
          id: "s1",
          name: "Kickoff",
          status: "in-progress",
          comments: [
            {
              id: "c-old",
              author: "PM",
              text: "ancient update",
              createdAt: new Date(Date.now() - 10 * 864e5).toISOString(),
            },
          ],
        },
      ],
    };
    const c = await renderPage();
    // in-progress step auto-expands → the ≥7d comment formats via toLocaleDateString
    expect(c.textContent).toContain("ancient update");
    const expected = new Date(Date.now() - 10 * 864e5).toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      timeZone: "Europe/Athens",
    });
    expect(c.textContent).toContain(expected);
  });

  it("request-changes panel cancels back to the action buttons", async () => {
    routes["GET /api/portal/tok1"] = DATA;
    const c = await renderPage();
    await click(screen.getByText("Request changes"));
    expect(c.textContent).toContain("Send change request");
    await click(screen.getByText("Cancel"));
    expect(c.textContent).not.toContain("Send change request");
    expect(c.textContent).toContain("Request changes");
  });
});
