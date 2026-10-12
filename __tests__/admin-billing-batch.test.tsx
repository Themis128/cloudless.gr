/**
 * Populated interactions: product-descriptions (generate/apply),
 * invoices (list/filter/create/finalize), subscriptions (portal/cancel/MRR),
 * appflowy/submissions (expand/status update/filter).
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
  const match = Object.keys(routes).find((k) => String(url).startsWith(k));
  const out = match ? routes[match] : undefined;
  if (typeof out === "function") return out(String(url), init);
  if (out instanceof Response) return out;
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...(args as [string, RequestInit?])),
}));
vi.mock("@/components/admin/InsightPanel", () => ({
  InsightPanel: () => <div data-testid="insight-panel" />,
}));

import ProductDescriptionsPage from "@/app/[locale]/admin/product-descriptions/page";
import InvoicesPage from "@/app/[locale]/admin/invoices/page";
import SubscriptionsPage from "@/app/[locale]/admin/subscriptions/page";
import SubmissionsPage from "@/app/[locale]/admin/appflowy/submissions/page";

const click = async (el: Element) => {
  await act(async () => fireEvent.click(el));
};
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const renderPage = async (el: React.JSX.Element) => {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(el).container;
  });
  return c!;
};

beforeEach(() => {
  routes = {};
  fetchWithAuthMock.mockClear();
  vi.stubGlobal("confirm", vi.fn(() => true));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("admin/product-descriptions", () => {
  const ROUTE = "/api/admin/ai/product-descriptions";

  it("generate → edit draft → apply approved", async () => {
    routes[ROUTE] = (_u: string, init?: RequestInit) => {
      if (init?.method === "POST")
        return okJson({
          results: [{ id: "p1", name: "Prod One", description: "desc one" }],
          errors: [{ id: "p2", error: "timeout" }],
        });
      return okJson({ applied: 1 });
    };
    const c = await renderPage(<ProductDescriptionsPage />);
    expect(c.textContent).toContain("Products (");

    await click(screen.getByText("Generate drafts"));
    const post = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "POST");
    expect(JSON.parse(String(post![1].body)).productIds.length).toBeGreaterThan(0);
    expect(c.textContent).toContain("Generated 1 draft");
    expect(c.textContent).toContain("timeout");

    // edit draft text + apply
    fireEvent.change(c.querySelector("textarea")!, { target: { value: "edited copy" } });
    await click(screen.getByText("Apply approved"));
    const put = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "PUT");
    const body = JSON.parse(String(put![1].body));
    expect(body.descriptions).toEqual([{ id: "p1", description: "edited copy" }]);
    expect(c.textContent).toContain("Applied 1 description");
  });

  it("select-all/clear toggles, 503 → notConfigured, error path", async () => {
    routes[ROUTE] = okJson({ error: "bad" }, 500);
    let c = await renderPage(<ProductDescriptionsPage />);

    await click(screen.getByText("Clear"));
    expect(c.textContent).toContain("Products (0/");
    const genBtn = screen.getByText("Generate drafts") as HTMLButtonElement;
    expect(genBtn.disabled).toBe(true);
    await click(screen.getByText("Select all"));

    await click(screen.getByText("Generate drafts"));
    await flush();
    expect(c.textContent).toContain("bad");

    // 503 → not-configured view
    routes[ROUTE] = okJson({}, 503);
    cleanup();
    c = await renderPage(<ProductDescriptionsPage />);
    await click(screen.getByText("Generate drafts"));
    await flush();
    expect(c.textContent).toContain("not configured");
  });
});

describe("admin/invoices", () => {
  const ROUTE = "/api/admin/invoices";
  const invoice = {
    id: "in_1",
    number: "INV-1",
    customerEmail: "c@x.gr",
    status: "draft",
    amountDue: 10000,
    amountPaid: 0,
    currency: "EUR",
    created: 1767225600,
    hostedInvoiceUrl: "https://stripe.example/inv",
  };

  it("list + filter + create + finalize", async () => {
    routes[ROUTE] = (_u: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const b = JSON.parse(String(init.body));
        if (b.action === "create") return okJson({ invoice });
        return okJson({});
      }
      return okJson({ invoices: [invoice] });
    };
    const c = await renderPage(<InvoicesPage />);
    expect(c.textContent).toContain("INV-1");
    expect(c.textContent).toContain("€100.00");

    // filter switches refetch with status param
    await click(screen.getByText("paid"));
    const paidCall = fetchWithAuthMock.mock.calls.find(([u]) =>
      String(u).includes("status=paid")
    );
    expect(paidCall).toBeDefined();

    // create draft
    const inputs = c.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "new@x.gr" } });
    fireEvent.change(inputs[1], { target: { value: "Consulting" } });
    fireEvent.change(inputs[2], { target: { value: "50" } });
    await click(screen.getByText("Draft"));
    const create = fetchWithAuthMock.mock.calls.find(
      ([, i]) => i?.method === "POST" && String(i.body).includes('"create"')
    );
    expect(JSON.parse(String(create![1].body)).email).toBe("new@x.gr");
    expect(c.textContent).toContain("Draft in_1 created");

    // finalize on draft invoice
    await click(screen.getByText("Finalize"));
    const fin = fetchWithAuthMock.mock.calls.find(
      ([, i]) => i?.method === "POST" && String(i.body).includes('"finalize"')
    );
    expect(fin).toBeDefined();
  });

  it("load error + open invoice action + empty", async () => {
    routes[ROUTE] = (_u: string, init?: RequestInit) =>
      init?.method === "GET" || !init ? okJson({}, 500) : okJson({});
    const c = await renderPage(<InvoicesPage />);
    expect(c.textContent).toContain("HTTP 500");

    routes[ROUTE] = okJson({ invoices: [] });
    cleanup();
    const c2 = await renderPage(<InvoicesPage />);
    expect(c2.textContent).toContain("No invoices in this filter");
  });
});

describe("admin/subscriptions", () => {
  const ROUTE = "/api/admin/subscriptions";
  const sub = {
    id: "sub_1",
    customerId: "cus_1",
    customerEmail: "s@x.gr",
    customerName: "Sam",
    status: "active",
    planName: "Pro",
    amount: 120000,
    currency: "EUR",
    interval: "year",
    currentPeriodEnd: 1767225600,
    created: 1735689600,
    cancelAtPeriodEnd: false,
  };

  it("MRR rollup + portal + cancel with confirm", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    routes[ROUTE] = (_u: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const b = JSON.parse(String(init.body));
        if (b.action === "portal") return okJson({ url: "https://billing.example/p" });
        return okJson({ ok: true });
      }
      return okJson({ subscriptions: [sub] });
    };
    const c = await renderPage(<SubscriptionsPage />);
    expect(c.textContent).toContain("s@x.gr");
    expect(c.textContent).toContain("€1,200/year"); // formatAmount
    expect(c.textContent).toContain("€100"); // MRR: 1200/12

    await click(screen.getByText("Portal"));
    const portal = fetchWithAuthMock.mock.calls.find(([, i]) =>
      String(i?.body).includes('"portal"')
    );
    expect(portal).toBeDefined();
    expect(openSpy).toHaveBeenCalledWith("https://billing.example/p", "_blank", "noopener,noreferrer");

    await click(screen.getByText("Cancel"));
    const cancel = fetchWithAuthMock.mock.calls.find(([, i]) =>
      String(i?.body).includes('"cancel"')
    );
    expect(cancel).toBeDefined();
    // success msg is cleared by the reload's setActionMessage(null) — transient

    // failed cancel keeps the error message
    routes[ROUTE] = (_u: string, init?: RequestInit) =>
      init?.method === "POST"
        ? okJson({ ok: false, error: "denied" })
        : okJson({ subscriptions: [sub] });
    await click(screen.getByText("Cancel"));
    await flush();
    expect(c.textContent).toContain("denied");
  });

  it("filter + error + empty", async () => {
    routes[ROUTE] = (_u: string, init?: RequestInit) =>
      init ? okJson({}) : okJson({ subscriptions: [] });
    const c = await renderPage(<SubscriptionsPage />);
    expect(c.textContent).toContain("No subscriptions found");

    await click(screen.getByText("past due"));
    const call = fetchWithAuthMock.mock.calls.find(([u]) =>
      String(u).includes("status=past_due")
    );
    expect(call).toBeDefined();

    routes[ROUTE] = (_u: string, init?: RequestInit) =>
      init ? okJson({}) : okJson({}, 500);
    cleanup();
    const c2 = await renderPage(<SubscriptionsPage />);
    expect(c2.textContent).toContain("HTTP 500");
  });
});

describe("admin/appflowy/submissions", () => {
  const ROUTE = "/api/admin/appflowy/submissions";
  const subs = [
    {
      id: "a1",
      name: "Nikos",
      email: "n@x.gr",
      company: "Acme",
      service: "audit",
      message: "hello there",
      status: "New",
      createdAt: "2026-01-01T00:00:00Z",
    },
    { id: "a2", name: "Maria", email: "m@x.gr", status: "Done" },
  ];

  it("expand + status update + filter pills", async () => {
    routes[ROUTE] = okJson({ submissions: subs });
    const c = await renderPage(<SubmissionsPage />);
    expect(c.textContent).toContain("Nikos");
    expect(c.textContent).toContain("2 submissions");

    // expand row → message + status buttons
    await click(screen.getByText("Nikos"));
    expect(c.textContent).toContain("hello there");

    // PATCH status → "In Review" (three status buttons in expanded area)
    const reviewBtns = screen.getAllByText("In Review");
    const inExpanded = reviewBtns.find(
      (b) => b.tagName === "BUTTON" && !(b as HTMLButtonElement).disabled
    )!;
    await click(inExpanded);
    const patch = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "PATCH");
    expect(JSON.parse(String(patch![1].body))).toMatchObject({
      pageId: "a1",
      status: "In Review",
    });

    // filter to "Done" via stat card → only Maria
    const doneCard = screen.getAllByText("Done")[0];
    await click(doneCard);
    expect(c.textContent).not.toContain("Nikos");
    expect(c.textContent).toContain("1 submission");
    await click(screen.getByText("Clear filter"));
    expect(c.textContent).toContain("Nikos");
  });

  it("error + empty", async () => {
    routes[ROUTE] = okJson({ error: "Notion submissions not configured" }, 500);
    const c = await renderPage(<SubmissionsPage />);
    expect(c.textContent).toContain("APPFLOWY_SUBMISSIONS_DB_ID");

    routes[ROUTE] = okJson({ submissions: [] });
    cleanup();
    const c2 = await renderPage(<SubmissionsPage />);
    expect(c2.textContent).toContain("No submissions yet");
  });
});
