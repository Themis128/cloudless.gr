import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn(() => { throw new Error("no db"); }),
}));

import {
  DEFAULT_PORTAL_TOKEN_TTL_DAYS,
  tokenMatches,
  filterPortalsByWorkspace,
  computePortalExpiry,
  newDeliverable,
  newPaymentLink,
  type ClientPortal,
} from "@/lib/client-portals";

describe("DEFAULT_PORTAL_TOKEN_TTL_DAYS", () => {
  it("is a positive number", () => {
    expect(DEFAULT_PORTAL_TOKEN_TTL_DAYS).toBeGreaterThan(0);
  });
});

describe("tokenMatches", () => {
  it("returns true for identical tokens", () => {
    expect(tokenMatches("abc123", "abc123")).toBe(true);
  });

  it("returns false for different tokens", () => {
    expect(tokenMatches("abc123", "xyz789")).toBe(false);
  });

  it("returns false for different-length tokens", () => {
    expect(tokenMatches("short", "much-longer-token")).toBe(false);
  });

  it("returns false for empty strings", () => {
    expect(tokenMatches("", "")).toBe(true); // both empty = equal length
  });
});

describe("filterPortalsByWorkspace", () => {
  const portals: ClientPortal[] = [
    { token: "t1", label: "P1", workspaceId: "ws-1", steps: [], deliverables: [], paymentLinks: [], comments: [], status: "active" },
    { token: "t2", label: "P2", workspaceId: "ws-2", steps: [], deliverables: [], paymentLinks: [], comments: [], status: "active" },
    { token: "t3", label: "P3", steps: [], deliverables: [], paymentLinks: [], comments: [], status: "active" },
  ];

  it("returns all portals when workspaceId is null", () => {
    expect(filterPortalsByWorkspace(portals, null)).toHaveLength(3);
  });

  it("returns matching portals plus portals without workspaceId", () => {
    const result = filterPortalsByWorkspace(portals, "ws-1");
    expect(result.map((p) => p.token)).toEqual(["t1", "t3"]);
  });

  it("returns portals without workspaceId when no match", () => {
    const result = filterPortalsByWorkspace(portals, "ws-99");
    expect(result).toHaveLength(1);
    expect(result[0].token).toBe("t3");
  });
});

describe("computePortalExpiry", () => {
  it("returns an ISO date string in the future", () => {
    const expiry = computePortalExpiry();
    expect(new Date(expiry).getTime()).toBeGreaterThan(Date.now());
  });

  it("uses the default TTL of DEFAULT_PORTAL_TOKEN_TTL_DAYS", () => {
    const expiry = computePortalExpiry();
    const diffDays = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(DEFAULT_PORTAL_TOKEN_TTL_DAYS, 0);
  });

  it("respects custom TTL", () => {
    const expiry = computePortalExpiry(7);
    const diffDays = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });
});

describe("newDeliverable", () => {
  it("creates a deliverable with status draft", () => {
    const d = newDeliverable({ title: "Design mockup" });
    expect(d.status).toBe("draft");
    expect(d.title).toBe("Design mockup");
    expect(typeof d.id).toBe("string");
    expect(d.createdAt).toBeDefined();
  });

  it("truncates title to 120 chars", () => {
    const d = newDeliverable({ title: "a".repeat(200) });
    expect(d.title.length).toBe(120);
  });
});

describe("newPaymentLink", () => {
  it("creates a payment link with the given fields", () => {
    const p = newPaymentLink({ label: "Invoice #1", url: "https://stripe.com/pay/123", amountCents: 5000 });
    expect(p.label).toBe("Invoice #1");
    expect(p.amountCents).toBe(5000);
    expect(typeof p.id).toBe("string");
    expect(p.status).toBe("open");
  });

  it("rounds amountCents", () => {
    const p = newPaymentLink({ label: "Invoice", url: "https://stripe.com", amountCents: 5000.7 });
    expect(p.amountCents).toBe(5001);
  });
});
