/**
 * Lib tail batch: stripe.ts (getStripe caching, sessions/products/invoices
 * mapping, customer resolve/create, draft invoice flow), secure-id.ts
 * fallback ladder, postiz-blog.ts share pipeline, ses-suppression re-export.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const libs = vi.hoisted(() => {
  const stripeApi = {
    checkout: { sessions: { list: vi.fn() } },
    products: { list: vi.fn() },
    invoices: { list: vi.fn(), create: vi.fn(), retrieve: vi.fn() },
    invoiceItems: { create: vi.fn() },
    customers: { list: vi.fn(), create: vi.fn() },
  };
  return {
    stripeApi,
    StripeCtor: vi.fn(function (this: unknown) {
      return stripeApi;
    }),
    cfg: { STRIPE_SECRET_KEY: "sk_test" } as Record<string, string>,
    postiz: {
      isPostizConfigured: vi.fn(async () => true),
      listPosts: vi.fn(async () => [] as Array<{ content?: string }>),
      listPostizIntegrations: vi.fn(async () => [] as Array<{ id: string; provider?: string }>),
      matchIntegrationsForPlatform: vi.fn(
        (_i: unknown, _p: string) => [] as Array<{ id: string }>
      ),
      schedulePost: vi.fn(async () => ({ ok: true, postIds: ["p1"] })),
      withSocialUtm: vi.fn((u: string, s: string, c: string) => `${u}?u=${s}&c=${c}`),
    },
  };
});
vi.mock("stripe", () => ({ default: libs.StripeCtor }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: async () => libs.cfg }));
vi.mock("@/lib/postiz", () => libs.postiz);

import {
  listRecentCheckoutSessions,
  listStripeProducts,
  listRecentInvoices,
  resolveOrCreateCustomerByEmail,
  createDraftInvoice,
} from "@/lib/stripe";
import { secureId } from "@/lib/secure-id";
import { scheduleBlogShare } from "@/lib/postiz-blog";

const { stripeApi, cfg, postiz } = libs;

beforeEach(() => {
  vi.clearAllMocks();
  cfg.STRIPE_SECRET_KEY = "sk_test";
  delete process.env.AUTO_POST_BLOG_TO_SOCIAL;
});
afterEach(() => delete process.env.AUTO_POST_BLOG_TO_SOCIAL);

describe("stripe lib", () => {
  it("null-safe when unconfigured; maps checkout sessions", async () => {
    cfg.STRIPE_SECRET_KEY = "";
    const mod = await import("@/lib/stripe");
    expect(await mod.listRecentCheckoutSessions()).toEqual({
      orders: [],
      hasMore: false,
    });
    expect(await mod.listStripeProducts()).toBeNull();

    cfg.STRIPE_SECRET_KEY = "sk_test";
    stripeApi.checkout.sessions.list.mockResolvedValue({
      has_more: true,
      data: [
        {
          id: "cs1",
          customer_email: null,
          customer_details: { email: "d@x.gr" },
          amount_total: 500,
          currency: "eur",
          status: "complete",
          created: 1,
          payment_status: "paid",
          mode: null,
        },
      ],
    });
    const { orders, hasMore } = await listRecentCheckoutSessions(5);
    expect(hasMore).toBe(true);
    expect(orders[0]).toMatchObject({
      email: "d@x.gr",
      amount: 500,
      currency: "EUR",
      mode: "payment",
    });
  });

  it("maps products incl. recurring price; null on throw", async () => {
    stripeApi.products.list.mockResolvedValue({
      data: [
        {
          id: "p1",
          name: "Plan",
          description: null,
          active: true,
          images: [],
          metadata: {},
          default_price: {
            id: "pr1",
            unit_amount: 1000,
            currency: "eur",
            recurring: { interval: "month", interval_count: 1 },
          },
        },
        {
          id: "p2",
          name: "One-off",
          description: "d",
          active: true,
          images: ["i"],
          metadata: { k: "v" },
          default_price: null,
        },
      ],
    });
    const prods = await listStripeProducts();
    expect(prods![0].defaultPrice).toMatchObject({
      id: "pr1",
      recurring: { interval: "month", intervalCount: 1 },
    });
    expect(prods![1].defaultPrice).toBeNull();

    stripeApi.products.list.mockRejectedValue(new Error("stripe down"));
    expect(await listStripeProducts()).toBeNull();
  });

  it("lists invoices with status filter, caps limit, maps customer shapes", async () => {
    stripeApi.invoices.list.mockResolvedValue({
      has_more: false,
      data: [
        {
          id: "in1",
          number: "N1",
          customer: "cus_abc",
          customer_email: null,
          status: "open",
          amount_due: 10,
          amount_paid: 0,
          currency: "usd",
          created: 2,
          hosted_invoice_url: "h",
          invoice_pdf: "p",
        },
        {
          id: "in2",
          number: null,
          customer: { id: "cus_x", email: "obj@x.gr" },
          customer_email: "inv@x.gr",
          status: null,
          amount_due: null,
          amount_paid: null,
          currency: null,
          created: 3,
          hosted_invoice_url: null,
          invoice_pdf: null,
        },
      ],
    });
    const r = await listRecentInvoices(999, "open");
    expect(stripeApi.invoices.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, status: "open" })
    );
    expect(r.invoices[0].customerId).toBe("cus_abc");
    expect(r.invoices[1]).toMatchObject({
      customerId: "cus_x",
      customerEmail: "inv@x.gr",
      status: "unknown",
      currency: "EUR",
    });

    await listRecentInvoices(0, "all");
    expect(stripeApi.invoices.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1 })
    );
  });

  it("resolves existing customer / creates with name / rejects bad email", async () => {
    expect(await resolveOrCreateCustomerByEmail("not-an-email")).toBeNull();

    stripeApi.customers.list.mockResolvedValue({ data: [{ id: "cus1" }] });
    expect(await resolveOrCreateCustomerByEmail(" A@B.GR ")).toBe("cus1");
    expect(stripeApi.customers.list).toHaveBeenCalledWith({
      email: "a@b.gr",
      limit: 1,
    });

    stripeApi.customers.list.mockResolvedValue({ data: [] });
    stripeApi.customers.create.mockResolvedValue({ id: "cus2" });
    expect(await resolveOrCreateCustomerByEmail("b@c.gr", "  Bee ")).toBe("cus2");
    expect(stripeApi.customers.create).toHaveBeenCalledWith({
      email: "b@c.gr",
      name: "Bee",
    });
  });

  it("createDraftInvoice: draft → invoiceItem → retrieve; guards bad input", async () => {
    expect(
      await createDraftInvoice({ customerId: "c", description: " ", amountCents: 100 })
    ).toBeNull();
    expect(
      await createDraftInvoice({ customerId: "c", description: "x", amountCents: 0 })
    ).toBeNull();

    stripeApi.invoices.create.mockResolvedValue({ id: "in_d" });
    stripeApi.invoices.retrieve.mockResolvedValue({
      id: "in_d",
      number: null,
      customer: "c",
      customer_email: "e@x.gr",
      status: "draft",
      amount_due: 700,
      amount_paid: 0,
      currency: "eur",
      created: 9,
      hosted_invoice_url: null,
      invoice_pdf: null,
    });
    const inv = await createDraftInvoice({
      customerId: "c",
      description: "Job",
      amountCents: 700,
      currency: "USD",
      daysUntilDue: 30,
    });
    expect(stripeApi.invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        pending_invoice_items_behavior: "exclude",
        days_until_due: 30,
        auto_advance: false,
      })
    );
    expect(stripeApi.invoiceItems.create).toHaveBeenCalledWith(
      expect.objectContaining({ invoice: "in_d", amount: 700, currency: "usd" })
    );
    expect(inv).toMatchObject({ id: "in_d", customerEmail: "e@x.gr" });
  });
});

describe("secureId fallback ladder", () => {
  it("randomUUID → getRandomValues → Date.now, with/without prefix", () => {
    const id = secureId("x_");
    expect(id).toMatch(/^x_[0-9a-f-]{36}$/);
    expect(secureId()).toMatch(/^[0-9a-f-]{36}$/);

    const origCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: (b: Uint8Array) => b.fill(0xab),
    });
    expect(secureId("h_")).toBe("h_" + "ab".repeat(8));

    vi.stubGlobal("crypto", undefined);
    expect(secureId("t_")).toMatch(/^t_\d+$/);
    vi.stubGlobal("crypto", origCrypto);
  });
});

describe("scheduleBlogShare", () => {
  const input = { pageId: "pg123", title: "T", excerpt: "E", url: "https://c.gr/b" };

  it("skips when feature flag off", async () => {
    expect(await scheduleBlogShare(input)).toEqual({
      ok: true,
      skipped: "feature_off",
      postIds: [],
    });
  });

  it("postiz unconfigured / already posted / list failure tolerated", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    postiz.isPostizConfigured.mockResolvedValueOnce(false);
    expect((await scheduleBlogShare(input)).skipped).toBe("postiz_unconfigured");

    postiz.listPosts.mockResolvedValueOnce([
      { content: "x blog-pg123 y" },
    ]);
    expect((await scheduleBlogShare(input)).skipped).toBe("already_posted");

    postiz.listPosts.mockRejectedValueOnce(new Error("postiz down"));
    postiz.listPostizIntegrations.mockResolvedValueOnce([]);
    const r = await scheduleBlogShare(input);
    expect(r.skipped).toBe("no_channels");
  });

  it("schedules per matched platform, collects ids and errors", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    postiz.matchIntegrationsForPlatform.mockImplementation((_i, p) =>
      p === "linkedin" ? [{ id: "i1" }] : p === "x" ? [{ id: "i2" }] : []
    );
    postiz.schedulePost
      .mockResolvedValueOnce({ ok: true, postIds: ["p-li"] })
      .mockResolvedValueOnce({ ok: false, error: "x quota" });
    const r = await scheduleBlogShare(input);
    expect(r.ok).toBe(true);
    expect(r.postIds).toEqual(["p-li"]);
    expect(r.error).toBe("x quota");
    expect(postiz.withSocialUtm).toHaveBeenCalledWith(
      input.url,
      "linkedin",
      "blog_pg123"
    );
    const content = postiz.schedulePost.mock.calls[0][0].content as string;
    expect(content).toContain("T\n\nE\n\n");
    expect(postiz.schedulePost.mock.calls[0][0].tags).toEqual([
      { value: "blog-pg123", label: "blog-pg123" },
    ]);
  });

  it("all-scheduled-failure path returns lastError", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    postiz.matchIntegrationsForPlatform.mockImplementation((_i, p) =>
      p === "meta" ? [{ id: "m1" }] : []
    );
    postiz.schedulePost.mockResolvedValueOnce({ ok: false, error: "boom" });
    const r = await scheduleBlogShare({ ...input, platforms: ["meta"] });
    expect(r).toEqual({ ok: false, postIds: [], error: "boom" });

    postiz.schedulePost.mockResolvedValueOnce({ ok: true, postIds: [] });
    const r2 = await scheduleBlogShare({ ...input, platforms: ["meta"] });
    expect(r2.error).toBe("Postiz returned no post ids");
  });
});

describe("ses-suppression barrel", () => {
  it("re-exports the D1 implementation", async () => {
    const mod = await import("@/lib/ses-suppression");
    for (const fn of [
      "addToSuppressionList",
      "removeFromSuppressionList",
      "isSuppressed",
      "getSuppressedEmails",
      "setD1Binding",
    ]) {
      expect(typeof mod[fn as keyof typeof mod]).toBe("function");
    }
  });
});
