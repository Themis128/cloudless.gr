/**
 * Populated-state interaction tests for the Delivery admin page — project
 * list, create form, time entries, log-time, status changes, bill-unbilled.
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

import DeliveryPage from "@/app/[locale]/admin/delivery/page";

const PROJECTS = [
  {
    id: "p1",
    name: "Site rebuild",
    clientEmail: "acme@x.gr",
    status: "active",
    totalMinutes: 750,
    unbilledMinutes: 120,
    hourlyRateCents: 8000,
    currency: "EUR",
    stripeCustomerId: "cus_1",
  },
  {
    id: "p2",
    name: "Retainer",
    clientEmail: null,
    status: "on_hold",
    totalMinutes: 45,
    unbilledMinutes: 0,
    hourlyRateCents: null,
    currency: "EUR",
    stripeCustomerId: null,
  },
];

const ENTRIES = [
  { id: "e1", workDate: "2026-01-05", minutes: 90, description: "API wiring", billable: true },
  {
    id: "e2",
    workDate: "2026-01-06",
    minutes: 30,
    description: null,
    billable: false,
    stripeInvoiceId: "in_9",
  },
];

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<DeliveryPage />).container;
  });
  return c!;
}
const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};
const submit = async (el: HTMLFormElement) => {
  await act(async () => fireEvent.submit(el));
};
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe("delivery — populated interactions", () => {
  beforeEach(() => {
    routes = {
      "/api/admin/delivery/projects": { projects: PROJECTS },
      "/api/admin/delivery/projects/p1/time": { entries: ENTRIES },
      "/api/admin/delivery/projects/p2/time": { entries: [] },
    };
    fetchWithAuthMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads projects, selects one, renders entries + rate; bill button", async () => {
    const c = await renderPage();
    expect(c.textContent).toContain("Site rebuild");
    expect(c.textContent).toContain("acme@x.gr");
    expect(c.textContent).toContain("13h"); // 750 min, ≥10h rounds to 0dp
    expect(c.textContent).toContain("on_hold");

    // select p1 → entries
    await click(screen.getByText("Site rebuild"));
    expect(c.textContent).toContain("80.00 EUR/h");
    expect(c.textContent).toContain("API wiring");
    expect(c.textContent).toContain("non-billable");
    expect(c.textContent).toContain("in_9");
    expect(c.textContent).toContain("Rate");

    // bill → draft invoice
    routes["/api/admin/delivery/projects/p1/invoice"] = {
      invoice: { id: "in_draft1" },
      amountCents: 16000,
      totalMinutes: 120,
    };
    await click(screen.getByText("Bill unbilled → draft"));
    expect(c.textContent).toContain("Draft in_draft1 created (€160.00 for 2.0h)");

    // select p2 (no rate/no email) → bill disabled
    await click(screen.getByText("Retainer"));
    expect(c.textContent).toContain("Rate unset");
    expect(c.textContent).toContain("No time logged yet");
    const bill = screen.getByText("Bill unbilled → draft") as HTMLButtonElement;
    expect(bill.disabled).toBe(true);
  });

  it("create project — success selects it; error path shows message", async () => {
    const c = await renderPage();

    // POST error
    routes["/api/admin/delivery/projects"] = (init?: RequestInit) =>
      init?.method === "POST"
        ? okJson({ error: "name taken" }, 409)
        : okJson({ projects: PROJECTS });
    const form = c.querySelector("form") as HTMLFormElement;
    const inputs = form.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "New proj" } });
    fireEvent.change(inputs[1], { target: { value: "n@x.gr" } });
    fireEvent.change(inputs[2], { target: { value: "75.5" } });
    await submit(form);
    expect(c.textContent).toContain("name taken");

    // POST success → created message + selectProject triggers entries fetch
    routes["/api/admin/delivery/projects"] = (init?: RequestInit) =>
      init?.method === "POST"
        ? okJson({ project: { id: "p9", name: "New proj" } })
        : okJson({ projects: [...PROJECTS, { id: "p9", name: "New proj", status: "active", totalMinutes: 0, unbilledMinutes: 0 }] });
    routes["/api/admin/delivery/projects/p9/time"] = { entries: [] };
    fireEvent.change(form.querySelectorAll("input")[0], { target: { value: "New proj" } });
    await submit(form);
    expect(c.textContent).toContain("Created New proj");
    const postCall = fetchWithAuthMock.mock.calls.find(
      ([u, i]) => String(u).includes("delivery/projects") && i?.method === "POST"
    );
    expect(JSON.parse(String(postCall![1].body))).toMatchObject({
      action: "create",
      name: "New proj",
    });

    // fetch throw → catch branch
    routes["/api/admin/delivery/projects"] = () => Promise.reject(new Error("net"));
    fireEvent.change(form.querySelectorAll("input")[0], { target: { value: "Z" } });
    await submit(form);
    expect(c.textContent).toContain("Failed to create project");
  });

  it("log time + status change + entries-load failure + load error", async () => {
    const c = await renderPage();
    await click(screen.getByText("Site rebuild"));

    // log time success
    routes["/api/admin/delivery/projects/p1/time"] = (init?: RequestInit) =>
      init?.method === "POST"
        ? okJson({ entry: { id: "e3", minutes: 45 } })
        : okJson({ entries: ENTRIES });
    const forms = c.querySelectorAll("form");
    const timeForm = forms[1] as HTMLFormElement;
    const hrs = timeForm.querySelector("input[type='number']") as HTMLInputElement;
    fireEvent.change(hrs, { target: { value: "0.75" } });
    const desc = timeForm.querySelectorAll("input")[2] as HTMLInputElement;
    fireEvent.change(desc, { target: { value: "docs" } });
    await submit(timeForm);
    expect(c.textContent).toContain("Logged 0.8h");

    // log time API error
    routes["/api/admin/delivery/projects/p1/time"] = (init?: RequestInit) =>
      init?.method === "POST" ? okJson({ error: "bad date" }, 400) : okJson({ entries: [] });
    await submit(timeForm);
    expect(c.textContent).toContain("bad date");

    // entries GET fails → "Failed to load time entries"
    routes["/api/admin/delivery/projects/p1/time"] = okJson({}, 500);
    await click(screen.getByText("Retainer")); // switch away
    await click(screen.getByText("Site rebuild"));
    expect(c.textContent).toContain("Failed to load time entries");

    // status change success + error
    routes["/api/admin/delivery/projects"] = (init?: RequestInit) =>
      init?.method === "POST" ? okJson({}) : okJson({ projects: PROJECTS });
    const sel = c.querySelectorAll("select")[0] as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: "done" } });
    await flush();
    const statusCall = fetchWithAuthMock.mock.calls.find(
      ([, i]) => i?.method === "POST" && String(i.body).includes("set_status")
    );
    expect(JSON.parse(String(statusCall![1].body))).toMatchObject({
      action: "set_status",
      id: "p1",
      status: "done",
    });
    routes["/api/admin/delivery/projects"] = (init?: RequestInit) =>
      init?.method === "POST" ? okJson({ error: "no" }, 500) : okJson({ projects: PROJECTS });
    fireEvent.change(sel, { target: { value: "cancelled" } });
    await flush();
    expect(c.textContent).toContain("no");

    // initial load error
    routes["/api/admin/delivery/projects"] = () => Promise.reject(new Error("down"));
    cleanup();
    const c2 = await renderPage();
    expect(c2.textContent).toContain("down");
  });

  it("bill error + empty list state", async () => {
    routes["/api/admin/delivery/projects"] = { projects: [] };
    const c = await renderPage();
    expect(c.textContent).toContain("No delivery projects yet");
    expect(c.textContent).toContain("Select a project to log hours");
  });

  it("bill unbilled error path", async () => {
    const c = await renderPage();
    await click(screen.getByText("Site rebuild"));
    routes["/api/admin/delivery/projects/p1/invoice"] = okJson({ error: "no stripe" }, 400);
    await click(screen.getByText("Bill unbilled → draft"));
    expect(c.textContent).toContain("no stripe");
    routes["/api/admin/delivery/projects/p1/invoice"] = () => Promise.reject(new Error("net"));
    await click(screen.getByText("Bill unbilled → draft"));
    expect(c.textContent).toContain("Failed to create draft invoice");
  });
});

describe("delivery — form tails", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockClear();
    routes["/api/admin/delivery/projects"] = { projects: PROJECTS };
  });

  it("log-time network throw -> 'Failed to log time'; date input + select click", async () => {
    const c = await renderPage();
    await click(screen.getByText("Site rebuild"));

    routes["/api/admin/delivery/projects/p1/time"] = () =>
      Promise.reject(new Error("net down"));
    const forms = c.querySelectorAll("form");
    const timeForm = forms[1] as HTMLFormElement;

    // workDate input onChange (covers the date-field handler)
    const dateInput = timeForm.querySelector("input[type='date']") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-02-14" } });
    expect(dateInput.value).toBe("2026-02-14");

    await submit(timeForm);
    expect(c.textContent).toContain("Failed to log time");

    // status select click — stopPropagation keeps the row select from firing
    const sel = c.querySelectorAll("select")[0] as HTMLSelectElement;
    fireEvent.click(sel);
    await flush();
  });
});
