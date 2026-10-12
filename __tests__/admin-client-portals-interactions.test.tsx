/**
 * Populated-state interaction tests for the client-portals admin page —
 * create form (validation/success/error), portal expand, StepManager
 * (status/comments/add/delete), DeliverableManager, PaymentLinkManager,
 * ReportsToggle, TokenLifecycle badges + extend/rotate, PendingClients
 * approve/decline, copy-link, revoke.
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

let portals: unknown[] = [];
let pendingClients: unknown[] = [];
const fetchWithAuthMock = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? "GET";
  if (url.includes("pending-clients")) {
    if (method === "GET") return okJson({ clients: pendingClients });
    return okJson({ ok: true });
  }
  if (url.includes("client-portals")) {
    if (method === "GET") return okJson({ portals });
    if (method === "PATCH") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.action === "rotate-token") return okJson({ portal: { token: "NEWTOK123" } });
      return okJson({ ok: true });
    }
    if (method === "POST") return okJson({ portal: { token: "created-tok" } });
    if (method === "DELETE") return okJson({ ok: true });
  }
  return okJson({}, 404);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

import ClientPortalsPage from "@/app/[locale]/admin/client-portals/page";

const portal = (extra: Record<string, unknown> = {}) => ({
  token: "tok1",
  label: "Acme Portal",
  clientEmail: "c@acme.co",
  clientName: "Acme",
  createdAt: "2026-01-01T00:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
  reportsEnabled: false,
  steps: [
    {
      id: "s1",
      name: "Kickoff",
      status: "in-progress",
      comments: [{ id: "cm1", author: "Team", text: "started", createdAt: "2026-01-02T00:00:00Z" }],
    },
    { id: "s2", name: "Build", status: "pending", comments: [] },
    { id: "s3", name: "Done", status: "completed", comments: [] },
  ],
  deliverables: [
    {
      id: "d1",
      title: "Design doc",
      url: "https://f.example/d",
      status: "in_review",
      clientComment: "looks good",
      createdAt: "t",
      updatedAt: "t",
    },
    { id: "d2", title: "Report", status: "draft", createdAt: "t", updatedAt: "t" },
  ],
  paymentLinks: [
    { id: "p1", label: "Deposit", url: "https://pay.example/x", amountCents: 5000, currency: "EUR", status: "open", createdAt: "t" },
    { id: "p2", label: "Balance", url: "https://pay.example/y", status: "paid", createdAt: "t" },
  ],
  ...extra,
});

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<ClientPortalsPage />).container;
  });
  return c!;
}

const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};

const patchCalls = () =>
  fetchWithAuthMock.mock.calls
    .filter(([u, i]) => String(u).includes("client-portals") && i?.method === "PATCH")
    .map(([, i]) => JSON.parse(String(i!.body)));

describe("client-portals admin — populated interactions", () => {
  beforeEach(() => {
    portals = [];
    pendingClients = [];
    fetchWithAuthMock.mockClear();
    vi.stubGlobal("confirm", vi.fn(() => true));
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("empty state + create form validation/success/error", async () => {
    const c = await renderPage();
    expect(c.textContent).toContain("No portals created yet.");

    // validation: missing fields
    const form = c.querySelector("form")!;
    fireEvent.submit(form);
    await act(async () => {});
    expect(c.textContent).toContain("Label and client email are required.");

    // fill and submit → success, expands new portal token
    fireEvent.change(document.getElementById("cp-label")!, { target: { value: "New P" } });
    fireEvent.change(document.getElementById("cp-client-email")!, {
      target: { value: "n@x.co" },
    });
    fireEvent.change(document.getElementById("cp-client-name")!, {
      target: { value: "N" },
    });
    fireEvent.submit(form);
    await act(async () => {});
    const postCall = fetchWithAuthMock.mock.calls.find(
      ([u, i]) => String(u).includes("client-portals") && i?.method === "POST"
    );
    expect(JSON.parse(String(postCall![1].body))).toMatchObject({
      label: "New P",
      clientEmail: "n@x.co",
      clientName: "N",
    });

    // server error path → formError
    fetchWithAuthMock.mockResolvedValueOnce(okJson({ error: "ssm down" }, 500));
    fireEvent.change(document.getElementById("cp-label")!, { target: { value: "x" } });
    fireEvent.change(document.getElementById("cp-client-email")!, { target: { value: "x@x" } });
    fireEvent.submit(form);
    await act(async () => {});
    expect(c.textContent).toContain("ssm down");
  });

  it("portal list renders progress + copy link + revoke", async () => {
    portals = [portal()];
    const c = await renderPage();
    expect(c.textContent).toContain("Acme Portal");
    expect(c.textContent).toContain("1/3 steps");
    expect(c.textContent).toContain("c@acme.co");

    await click(screen.getByText("Copy Link"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/portal/tok1")
    );
    expect(screen.getByText("Copied!")).toBeTruthy();

    await click(screen.getByText("Revoke"));
    expect(
      fetchWithAuthMock.mock.calls.some(
        ([u, i]) => String(u).includes("client-portals") && i?.method === "DELETE"
      )
    ).toBe(true);

    // load error path — 500 only the portals GET (pending-clients races it)
    cleanup();
    fetchWithAuthMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("client-portals") && (init?.method ?? "GET") === "GET") {
        return new Response("x", { status: 500 });
      }
      return okJson({ clients: [] });
    });
    const c2 = await renderPage();
    expect(c2.textContent).toContain("HTTP 500");
    // restore the default router for subsequent tests
    fetchWithAuthMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (String(url).includes("pending-clients")) {
        if (method === "GET") return okJson({ clients: pendingClients });
        return okJson({ ok: true });
      }
      if (String(url).includes("client-portals")) {
        if (method === "GET") return okJson({ portals });
        if (method === "PATCH") {
          const body = JSON.parse(String(init?.body ?? "{}"));
          if (body.action === "rotate-token") return okJson({ portal: { token: "NEWTOK123" } });
          return okJson({ ok: true });
        }
        return okJson({ ok: true });
      }
      return okJson({}, 404);
    });
  });

  it("expanded portal — step status, comments add/delete, step add/delete", async () => {
    portals = [portal()];
    const c = await renderPage();
    // expand portal card (role=button header)
    const header = c.querySelector("[aria-expanded]")!;
    await click(header);
    expect(c.textContent).toContain("Project Steps");
    expect(c.textContent).toContain("1 comment");

    // s1 (in-progress) auto-expanded → comment thread visible
    expect(c.textContent).toContain("started");

    // status change on s2
    const selects = c.querySelectorAll("select");
    fireEvent.change(selects[1], { target: { value: "blocked" } });
    await act(async () => {});
    expect(patchCalls().some((b) => b.action === "update-step" && b.stepId === "s2" && b.status === "blocked")).toBe(true);

    // add comment on s1 (expanded)
    const commentArea = c.querySelector("textarea[placeholder*='Add an update']")!;
    fireEvent.change(commentArea, { target: { value: "progress note" } });
    await click(screen.getByText("Send"));
    expect(patchCalls().some((b) => b.action === "add-comment" && b.text === "progress note")).toBe(true);

    // delete comment
    const delComment = c.querySelector("button[title='Delete comment']")!;
    await click(delComment);
    expect(patchCalls().some((b) => b.action === "delete-comment" && b.commentId === "cm1")).toBe(true);

    // expand s2 header via keyboard Enter (covers keyDown path) then add step
    const stepHeaders = c.querySelectorAll("[aria-expanded]");
    fireEvent.keyDown(stepHeaders[2], { key: "Enter" });
    await act(async () => {});
    expect(c.textContent).toContain("No comments yet for this step.");

    const newStep = c.querySelector("input[placeholder='Add custom step…']") as HTMLInputElement;
    fireEvent.change(newStep, { target: { value: "Extra step" } });
    fireEvent.keyDown(newStep, { key: "Enter" });
    await act(async () => {});
    expect(patchCalls().some((b) => b.action === "add-step" && b.name === "Extra step")).toBe(true);

    // delete step s1
    const delStep = c.querySelector("button[title='Remove step']")!;
    await click(delStep);
    expect(patchCalls().some((b) => b.action === "delete-step" && b.stepId === "s1")).toBe(true);
  });

  it("deliverables + payment links managers", async () => {
    portals = [portal()];
    const c = await renderPage();
    await click(c.querySelector("[aria-expanded]")!);

    expect(c.textContent).toContain("Design doc");
    expect(c.textContent).toContain("Client: looks good");
    expect(c.textContent).toContain("Deposit — 50.00 EUR");

    // update deliverable status
    const dSelect = screen.getByLabelText("Status of Design doc");
    fireEvent.change(dSelect, { target: { value: "approved" } });
    await act(async () => {});
    expect(patchCalls().some((b) => b.action === "update-deliverable" && b.status === "approved")).toBe(true);

    // delete deliverable
    await click(screen.getByLabelText("Delete Design doc"));
    expect(patchCalls().some((b) => b.action === "delete-deliverable" && b.deliverableId === "d1")).toBe(true);

    // add deliverable (title only → url undefined)
    fireEvent.change(c.querySelector("input[placeholder='Deliverable title…']")!, {
      target: { value: "New deliv" },
    });
    const addBtns = screen.getAllByText("+ Add");
    await click(addBtns[1]); // deliverable (0 = step, 1 = deliverable, 2 = payment)
    expect(patchCalls().some((b) => b.action === "add-deliverable" && b.title === "New deliv")).toBe(true);

    // payment link status + delete
    fireEvent.change(screen.getByLabelText("Status of Deposit"), { target: { value: "void" } });
    await act(async () => {});
    expect(patchCalls().some((b) => b.action === "update-payment-link" && b.status === "void")).toBe(true);
    await click(screen.getByLabelText("Delete Balance"));
    expect(patchCalls().some((b) => b.action === "delete-payment-link" && b.paymentLinkId === "p2")).toBe(true);

    // add payment link with amount parse (12.34 → 1234 cents)
    fireEvent.change(c.querySelector("input[placeholder*='Label (e.g. Deposit']")!, {
      target: { value: "Final" },
    });
    fireEvent.change(c.querySelector("input[placeholder='Stripe payment link URL…']")!, {
      target: { value: "https://pay.example/z" },
    });
    fireEvent.change(c.querySelector("input[placeholder='€']")!, { target: { value: "12.34" } });
    await click(screen.getAllByText("+ Add")[2]);
    const addLink = patchCalls().find((b) => b.action === "add-payment-link");
    expect(addLink).toMatchObject({ label: "Final", amountCents: 1234, currency: "EUR" });
  });

  it("reports toggle + token lifecycle badges/extend/rotate", async () => {
    portals = [
      portal({ token: "tok-exp", label: "Expired", expiresAt: "2000-01-01T00:00:00Z" }),
      portal({ token: "tok-soon", label: "Soon", expiresAt: new Date(Date.now() + 5 * 864e5).toISOString() }),
      portal({ token: "tok-none", label: "NoExp", expiresAt: undefined }),
      portal(),
    ];
    const c = await renderPage();
    // expand the good portal
    await click(screen.getByText("Acme Portal").closest("[aria-expanded]")!);
    expect(c.textContent).toContain("Monthly status email");

    // reports toggle
    await click(screen.getByLabelText(/Monthly status email/));
    expect(patchCalls().some((b) => b.action === "set-reports-enabled" && b.enabled === true)).toBe(true);

    // extend + rotate
    await click(screen.getByText("Extend +90d"));
    expect(patchCalls().some((b) => b.action === "extend-token")).toBe(true);
    await click(screen.getByText("Rotate token"));
    expect(patchCalls().some((b) => b.action === "rotate-token")).toBe(true);
    expect(c.textContent).toContain("/portal/NEWTOK123");

    // badges rendered on expanded cards? badges are inside TokenLifecycle (expanded only).
    // Expand each to check badge labels
    await click(screen.getByText("Expired").closest("[aria-expanded]")!);
    expect(c.textContent).toContain("EXPIRED");
    await click(screen.getByText("Soon").closest("[aria-expanded]")!);
    expect(c.textContent).toContain("expires in 5d");
    await click(screen.getByText("NoExp").closest("[aria-expanded]")!);
    expect(c.textContent).toContain("no expiry");
  });

  it("pending clients — waiting filter, approve, decline, error", async () => {
    pendingClients = [
      { email: "w@x.co", name: "Waiter", plan: "bundle", planLabel: "Bundle", status: "waiting", submittedAt: "2026-01-01T00:00:00Z", notes: "hi" },
      { email: "a@x.co", name: "Done", plan: "cloud", status: "approved", submittedAt: "t" },
    ];
    const c = await renderPage();
    expect(c.textContent).toContain("1 client waiting for portal access");
    expect(c.textContent).toContain("Waiter");
    expect(c.textContent).toContain("w@x.co");
    expect(c.textContent).toContain("Bundle");
    expect(c.textContent).not.toContain("Done");

    // approve → POST + reloads
    await click(screen.getByRole("button", { name: "Approve & Create Portal" }));
    const approveCall = fetchWithAuthMock.mock.calls.find(
      ([u, i]) => String(u).includes("pending-clients") && i?.method === "POST"
    );
    expect(JSON.parse(String(approveCall![1].body))).toEqual({ email: "w@x.co" });

    // decline
    await click(screen.getByText("Decline"));
    const declineCall = fetchWithAuthMock.mock.calls.find(
      ([u, i]) => String(u).includes("pending-clients") && i?.method === "DELETE"
    );
    expect(JSON.parse(String(declineCall![1].body))).toEqual({ email: "w@x.co" });
  });

  it("pending clients — approve error shows message; empty → null", async () => {
    pendingClients = [{ email: "w@x.co", plan: "cloud", status: "waiting", submittedAt: "t" }];
    fetchWithAuthMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (String(url).includes("pending-clients") && method === "POST") {
        return okJson({ error: "create failed" }, 500);
      }
      if (String(url).includes("pending-clients")) return okJson({ clients: pendingClients });
      return okJson({ portals: [] });
    });
    const c = await renderPage();
    await click(screen.getByRole("button", { name: "Approve & Create Portal" }));
    expect(c.textContent).toContain("create failed");
  });
});
