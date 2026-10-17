/**
 * Branch tests for the client-portals admin page: confirm-declined guards,
 * accordion collapse and ignored keys, sparse portal data (no deliverables /
 * payment links, unknown step status), rotate-token edge responses, and the
 * fallback error messages for load / create / approve.
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

type Handler = (url: string, method: string, body: Record<string, unknown>) => unknown;

let portals: unknown[] = [];
let pendingClients: unknown[] = [];
let override: Handler | null = null;

const fetchWithAuthMock = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (override) {
    const r = await override(url, method, body);
    if (r !== undefined) return r as Response;
  }
  if (url.includes("pending-clients")) {
    if (method === "GET") return okJson({ clients: pendingClients });
    return okJson({ ok: true });
  }
  if (method === "GET") return okJson({ portals });
  if (method === "POST") return okJson({ portal: { token: "created-tok" } });
  return okJson({ ok: true });
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

import ClientPortalsPage from "@/app/[locale]/admin/client-portals/page";

const basePortal = (extra: Record<string, unknown> = {}) => ({
  token: "tok1",
  label: "Acme Portal",
  clientEmail: "c@acme.co",
  createdAt: "2026-01-01T00:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
  reportsEnabled: false,
  steps: [
    {
      id: "s1",
      name: "Kickoff",
      status: "pending",
      comments: [
        { id: "cm1", author: "Team", text: "one", createdAt: "2026-01-02T00:00:00Z" },
        { id: "cm2", author: "Team", text: "two", createdAt: "2026-01-03T00:00:00Z" },
      ],
    },
    // status outside STEP_STATUS_OPTIONS → falls back to slate colour class
    { id: "s2", name: "Legacy", status: "archived", comments: [] },
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

const calls = (method: string, part = "client-portals") =>
  fetchWithAuthMock.mock.calls
    .filter(([u, i]) => String(u).includes(part) && (i?.method ?? "GET") === method)
    .map(([, i]) => (i?.body ? JSON.parse(String(i.body)) : {}));

const cardHeader = (label = "Acme Portal") => screen.getByText(label).closest("[aria-expanded]")!;
const stepHeader = (name: string) => screen.getByText(name).closest("[aria-expanded]")!;

describe("client-portals admin — branch coverage", () => {
  beforeEach(() => {
    portals = [basePortal()];
    pendingClients = [];
    override = null;
    fetchWithAuthMock.mockClear();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true)
    );
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sparse portal: no in-progress step, plural comments, unknown status, empty managers", async () => {
    const c = await renderPage();
    expect(c.textContent).toContain("0/2 steps");
    await click(cardHeader());

    // no step is in-progress → nothing auto-expanded
    expect(stepHeader("Kickoff").getAttribute("aria-expanded")).toBe("false");
    expect(c.textContent).toContain("2 comments");
    expect(c.textContent).not.toContain("No comments yet for this step.");

    const legacySelect = stepHeader("Legacy").querySelector("select")!;
    expect(legacySelect.className).toContain("text-slate-400");

    // deliverables / paymentLinks absent on the record → empty-state copy
    expect(c.textContent).toContain("No deliverables yet.");
    expect(c.textContent).toContain("No payment links yet.");
  });

  it("accordions collapse on second click / key and ignore other keys", async () => {
    await renderPage();
    const card = cardHeader();
    fireEvent.keyDown(card, { key: "a" });
    await act(async () => {});
    expect(card.getAttribute("aria-expanded")).toBe("false");

    await click(card);
    expect(card.getAttribute("aria-expanded")).toBe("true");

    const step = stepHeader("Kickoff");
    fireEvent.keyDown(step, { key: "Tab" });
    await act(async () => {});
    expect(step.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(step, { key: "Enter" });
    await act(async () => {});
    expect(step.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(step, { key: " " });
    await act(async () => {});
    expect(step.getAttribute("aria-expanded")).toBe("false");
    await click(step);
    expect(step.getAttribute("aria-expanded")).toBe("true");
    await click(step);
    expect(step.getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(card, { key: " " });
    await act(async () => {});
    expect(card.getAttribute("aria-expanded")).toBe("false");
    await click(card);
    await click(card);
    expect(card.getAttribute("aria-expanded")).toBe("false");
  });

  it("comment and step guards: blank author falls back, plain Enter / blank input do nothing", async () => {
    await renderPage();
    await click(cardHeader());
    await click(stepHeader("Kickoff"));

    fireEvent.change(document.getElementById("portal-comment-author")!, {
      target: { value: "" },
    });
    const draft = screen.getByPlaceholderText(/Ctrl\+Enter to send/);

    // whitespace-only draft + Ctrl+Enter → submitComment returns early
    fireEvent.change(draft, { target: { value: "   " } });
    await act(async () => fireEvent.keyDown(draft, { key: "Enter", ctrlKey: true }));
    expect(calls("PATCH").some((b) => b.action === "add-comment")).toBe(false);

    // plain Enter (no modifier) does not submit
    fireEvent.change(draft, { target: { value: "hello" } });
    await act(async () => fireEvent.keyDown(draft, { key: "Enter" }));
    expect(calls("PATCH").some((b) => b.action === "add-comment")).toBe(false);

    // Cmd+Enter submits with the default author
    await act(async () => fireEvent.keyDown(draft, { key: "Enter", metaKey: true }));
    expect(calls("PATCH").find((b) => b.action === "add-comment")).toMatchObject({
      author: "Cloudless Team",
      text: "hello",
      stepId: "s1",
    });

    const newStep = screen.getByPlaceholderText("Add custom step…");
    fireEvent.change(newStep, { target: { value: "  " } });
    await act(async () => fireEvent.keyDown(newStep, { key: "Enter" }));
    fireEvent.change(newStep, { target: { value: "Real step" } });
    await act(async () => fireEvent.keyDown(newStep, { key: "a" }));
    expect(calls("PATCH").some((b) => b.action === "add-step")).toBe(false);
  });

  it("declined confirms abort every destructive action", async () => {
    (globalThis.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);
    pendingClients = [{ email: "w@x.co", plan: "cloud", status: "waiting", submittedAt: "t" }];
    portals = [
      basePortal({
        deliverables: [{ id: "d1", title: "Doc", status: "draft", createdAt: "t", updatedAt: "t" }],
        paymentLinks: [
          { id: "p1", label: "Dep", url: "https://p.example", status: "open", createdAt: "t" },
        ],
      }),
    ];
    await renderPage();
    await click(screen.getByText("Decline"));
    await click(screen.getByText("Revoke"));
    await click(cardHeader());
    await click(stepHeader("Kickoff"));
    await click(document.querySelector("button[title='Delete comment']"));
    await click(document.querySelector("button[title='Remove step']"));
    await click(screen.getByLabelText("Delete Doc"));
    await click(screen.getByLabelText("Delete Dep"));

    expect(globalThis.confirm).toHaveBeenCalledTimes(6);
    expect(calls("DELETE", "pending-clients")).toHaveLength(0);
    expect(calls("DELETE")).toHaveLength(0);
    expect(calls("PATCH")).toHaveLength(0);
  });

  it("payment links: no amount / unparsable amount send undefined cents; currency defaults to EUR", async () => {
    portals = [
      basePortal({
        paymentLinks: [
          {
            id: "p1",
            label: "Dep",
            url: "https://p.example",
            amountCents: 1999,
            status: "open",
            createdAt: "t",
          },
        ],
      }),
    ];
    const c = await renderPage();
    await click(cardHeader());
    expect(c.textContent).toContain("Dep — 19.99 EUR");

    // the list reloads after each add, so re-query the inputs every time
    const label = () => c.querySelector("input[placeholder*='Label (e.g. Deposit']")!;
    const url = () => c.querySelector("input[placeholder='Stripe payment link URL…']")!;
    const amount = () => c.querySelector("input[placeholder='€']")!;

    fireEvent.change(label(), { target: { value: "NoAmount" } });
    fireEvent.change(url(), { target: { value: "https://p.example/a" } });
    await click(screen.getAllByText("+ Add")[2]);

    fireEvent.change(label(), { target: { value: "BadAmount" } });
    fireEvent.change(url(), { target: { value: "https://p.example/b" } });
    fireEvent.change(amount(), { target: { value: "abc" } });
    await click(screen.getAllByText("+ Add")[2]);

    const adds = calls("PATCH").filter((b) => b.action === "add-payment-link");
    expect(adds.map((b) => b.label)).toEqual(["NoAmount", "BadAmount"]);
    for (const b of adds) expect(b.amountCents).toBeUndefined();
  });

  it("rotate token: non-ok response, ok without token, unreadable body", async () => {
    let mode: "fail" | "empty" | "bad" = "fail";
    override = (_u, method, body) => {
      if (method !== "PATCH" || body.action !== "rotate-token") return undefined;
      if (mode === "fail") return okJson({ error: "nope" }, 500);
      if (mode === "empty") return okJson({});
      return new Response("not json", { status: 200 });
    };
    const c = await renderPage();
    await click(cardHeader());
    const getsBefore = calls("GET").length;

    await click(screen.getByText("Rotate token"));
    expect(c.textContent).not.toContain("Token rotated");
    // failed rotate does not reload the list
    expect(calls("GET")).toHaveLength(getsBefore);

    mode = "empty";
    await click(screen.getByText("Rotate token"));
    mode = "bad";
    await click(screen.getByText("Rotate token"));
    expect(calls("PATCH").filter((b) => b.action === "rotate-token")).toHaveLength(3);
    // ok responses reload the list, but no new token hint is shown
    expect(calls("GET").length).toBeGreaterThan(getsBefore);
    expect(c.textContent).not.toContain("Token rotated");
  });

  it("copied badge clears after 2s and the expiry clock ticks every minute", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    await renderPage();
    await click(screen.getByText("Copy Link"));
    expect(screen.getByText("Copied!")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("Copied!")).toBeNull();

    await click(cardHeader());
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(document.body.textContent).toMatch(/expires in \d+d/);
  });

  it("portal load: missing portals field → empty state; non-Error rejection → fallback message", async () => {
    override = (u, method) =>
      u.includes("client-portals") && method === "GET" ? okJson({}) : undefined;
    const c = await renderPage();
    expect(c.textContent).toContain("No portals created yet.");

    cleanup();
    override = (u, method) => {
      if (u.includes("client-portals") && method === "GET") throw "boom";
      return undefined;
    };
    const c2 = await renderPage();
    expect(c2.textContent).toContain("Failed to load portals");
  });

  it("create: error body without message → HTTP status; non-Error rejection → fallback", async () => {
    let mode: "status" | "throw" = "status";
    override = (_u, method) => {
      if (method !== "POST") return undefined;
      if (mode === "status") return okJson({}, 503);
      throw "kaput";
    };
    const c = await renderPage();
    const fill = () => {
      fireEvent.change(document.getElementById("cp-label")!, { target: { value: "L" } });
      fireEvent.change(document.getElementById("cp-client-email")!, {
        target: { value: "l@x.co" },
      });
    };
    fill();
    fireEvent.submit(c.querySelector("form")!);
    await act(async () => {});
    expect(c.textContent).toContain("HTTP 503");

    mode = "throw";
    fill();
    fireEvent.submit(c.querySelector("form")!);
    await act(async () => {});
    expect(c.textContent).toContain("Failed to create portal");
  });

  it("pending clients: plural heading; approve errors fall back to status / generic text", async () => {
    portals = [];
    pendingClients = [
      { email: "a@x.co", plan: "cloud", status: "waiting", submittedAt: "t" },
      { email: "b@x.co", plan: "cloud", status: "waiting", submittedAt: "t" },
    ];
    let mode: "status" | "badjson" | "throw" = "status";
    override = (u, method) => {
      if (!u.includes("pending-clients") || method !== "POST") return undefined;
      if (mode === "status") return okJson({}, 409);
      if (mode === "badjson") return new Response("<html>", { status: 502 });
      throw "nope";
    };
    const c = await renderPage();
    expect(c.textContent).toContain("2 clients waiting for portal access");

    const approve = () => screen.getAllByRole("button", { name: "Approve & Create Portal" })[0];
    await click(approve());
    expect(c.textContent).toContain("HTTP 409");
    mode = "badjson";
    await click(approve());
    expect(c.textContent).toContain("HTTP 502");
    mode = "throw";
    await click(approve());
    expect(c.textContent).toContain("Failed to approve");
  });

  it("pending clients: non-ok list and missing clients field render nothing", async () => {
    override = (u, method) =>
      u.includes("pending-clients") && method === "GET"
        ? new Response("x", { status: 500 })
        : undefined;
    const c = await renderPage();
    expect(c.textContent).not.toContain("waiting for portal access");

    cleanup();
    override = (u, method) =>
      u.includes("pending-clients") && method === "GET" ? okJson({}) : undefined;
    const c2 = await renderPage();
    expect(c2.textContent).not.toContain("waiting for portal access");
    expect(c2.textContent).toContain("Acme Portal");
  });
});
