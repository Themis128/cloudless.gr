/**
 * Unit tests for src/lib/stripe.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: (...a: unknown[]) => mockGetConfig(...a),
  resetSsmCache: vi.fn(),
}));

// Mock Stripe constructor — must be a real class so `new Stripe()` works
const mockCheckoutSessionsList = vi.fn();
const mockCustomersList = vi.fn();
const mockSubscriptionsList = vi.fn();
const mockInvoicesCreate = vi.fn();
const mockInvoicesRetrieve = vi.fn();
const mockInvoiceItemsCreate = vi.fn();

vi.mock("stripe", () => {
  class MockStripe {
    checkout = { sessions: { list: mockCheckoutSessionsList } };
    customers = { list: mockCustomersList };
    subscriptions = { list: mockSubscriptionsList };
    invoices = { create: mockInvoicesCreate, retrieve: mockInvoicesRetrieve };
    invoiceItems = { create: mockInvoiceItemsCreate };
  }
  return { default: MockStripe };
});

describe("stripe.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("getStripe", () => {
    it("returns null when STRIPE_SECRET_KEY is not set", async () => {
      mockGetConfig.mockResolvedValue({});
      const { getStripe } = await import("@/lib/stripe");
      await expect(getStripe()).resolves.toBeNull();
    });

    it("returns Stripe instance when key is present", async () => {
      mockGetConfig.mockResolvedValue({ STRIPE_SECRET_KEY: "sk_test_123" });
      const { getStripe } = await import("@/lib/stripe");
      const stripe = await getStripe();
      expect(stripe).toBeDefined();
      expect(typeof stripe.checkout.sessions.list).toBe("function");
    });

    it("caches the instance (only calls constructor once)", async () => {
      mockGetConfig.mockResolvedValue({ STRIPE_SECRET_KEY: "sk_test_123" });
      const { getStripe } = await import("@/lib/stripe");
      const a = await getStripe();
      const b = await getStripe();
      expect(a).toBe(b);
    });
  });

  describe("listRecentCheckoutSessions", () => {
    it("returns mapped orders and hasMore from Stripe", async () => {
      mockGetConfig.mockResolvedValue({ STRIPE_SECRET_KEY: "sk_test_123" });
      mockCheckoutSessionsList.mockResolvedValue({
        data: [
          {
            id: "cs_1",
            payment_status: "paid",
            amount_total: 4900,
            currency: "eur",
            customer_email: "a@test.com",
            customer_details: null,
            created: 1700000000,
            status: "complete",
            mode: "payment",
            line_items: { data: [{ description: "Product A", quantity: 1, amount_total: 4900 }] },
          },
        ],
        has_more: false,
      });
      const { listRecentCheckoutSessions } = await import("@/lib/stripe");
      const result = await listRecentCheckoutSessions(10);
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].id).toBe("cs_1");
      expect(result.hasMore).toBe(false);
    });

    it("returns empty result when not configured", async () => {
      mockGetConfig.mockResolvedValue({});
      const { listRecentCheckoutSessions } = await import("@/lib/stripe");
      await expect(listRecentCheckoutSessions()).resolves.toEqual({ orders: [], hasMore: false });
    });
  });

  describe("listStripeProducts", () => {
    it("returns null when not configured", async () => {
      mockGetConfig.mockResolvedValue({});
      const { listStripeProducts } = await import("@/lib/stripe");
      const products = await listStripeProducts();
      expect(products).toBeNull();
    });
  });

  describe("createDraftInvoice", () => {
    it("returns null when Stripe is not configured", async () => {
      mockGetConfig.mockResolvedValue({});
      const { createDraftInvoice } = await import("@/lib/stripe");
      await expect(
        createDraftInvoice({
          customerId: "cus_1",
          description: "Work",
          amountCents: 15000,
        })
      ).resolves.toBeNull();
    });

    it("returns null for empty description or non-positive amount", async () => {
      mockGetConfig.mockResolvedValue({ STRIPE_SECRET_KEY: "sk_test_123" });
      const { createDraftInvoice } = await import("@/lib/stripe");
      await expect(
        createDraftInvoice({ customerId: "cus_1", description: "  ", amountCents: 100 })
      ).resolves.toBeNull();
      await expect(
        createDraftInvoice({ customerId: "cus_1", description: "Work", amountCents: 0 })
      ).resolves.toBeNull();
      expect(mockInvoicesCreate).not.toHaveBeenCalled();
    });

    it("creates the draft first, attaches the line item to that invoice, then retrieves", async () => {
      mockGetConfig.mockResolvedValue({ STRIPE_SECRET_KEY: "sk_test_123" });
      mockInvoicesCreate.mockResolvedValue({ id: "in_draft" });
      mockInvoiceItemsCreate.mockResolvedValue({ id: "ii_1" });
      mockInvoicesRetrieve.mockResolvedValue({
        id: "in_draft",
        number: null,
        customer: "cus_1",
        customer_email: "a@b.com",
        status: "draft",
        amount_due: 15000,
        amount_paid: 0,
        currency: "eur",
        created: 1_700_000_000,
        hosted_invoice_url: null,
        invoice_pdf: null,
      });

      const { createDraftInvoice } = await import("@/lib/stripe");
      const invoice = await createDraftInvoice({
        customerId: "cus_1",
        description: "OpVal — 1.5h",
        amountCents: 15000,
        currency: "EUR",
      });

      expect(mockInvoicesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_1",
          collection_method: "send_invoice",
          auto_advance: false,
          pending_invoice_items_behavior: "exclude",
        })
      );
      expect(mockInvoiceItemsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_1",
          invoice: "in_draft",
          amount: 15000,
          currency: "eur",
          description: "OpVal — 1.5h",
        })
      );
      const createOrder = mockInvoicesCreate.mock.invocationCallOrder[0];
      const itemOrder = mockInvoiceItemsCreate.mock.invocationCallOrder[0];
      const retrieveOrder = mockInvoicesRetrieve.mock.invocationCallOrder[0];
      expect(createOrder).toBeLessThan(itemOrder);
      expect(itemOrder).toBeLessThan(retrieveOrder);
      expect(invoice).toEqual(
        expect.objectContaining({
          id: "in_draft",
          amountDue: 15000,
          status: "draft",
          currency: "EUR",
        })
      );
    });
  });
});
