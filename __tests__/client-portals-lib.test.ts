import { describe, expect, it } from "vitest";
import {
  tokenMatches,
  newDeliverable,
  newPaymentLink,
  applyClientResponse,
  clientVisibleDeliverables,
  type ClientPortal,
  type PortalDeliverable,
} from "@/lib/client-portals";
import { buildReportHtml } from "@/lib/client-report-email";

function makePortal(overrides: Partial<ClientPortal> = {}): ClientPortal {
  return {
    token: "11111111-2222-3333-4444-555555555555",
    label: "Website Rebuild",
    clientEmail: "client@acme.com",
    clientName: "Acme",
    createdAt: "2026-06-01T00:00:00Z",
    steps: [
      { id: "s1", name: "Audit", status: "completed", comments: [] },
      { id: "s2", name: "Build", status: "in-progress", comments: [] },
    ],
    ...overrides,
  };
}

function makeDeliverable(status: PortalDeliverable["status"]): PortalDeliverable {
  return {
    id: "d1",
    title: "Homepage design",
    status,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  };
}

describe("tokenMatches", () => {
  it("matches identical tokens and rejects different ones", () => {
    expect(tokenMatches("abc", "abc")).toBe(true);
    expect(tokenMatches("abc", "abd")).toBe(false);
    expect(tokenMatches("abc", "abcd")).toBe(false);
    expect(tokenMatches("", "abc")).toBe(false);
  });
});

describe("newDeliverable / newPaymentLink", () => {
  it("creates a draft deliverable with bounded fields", () => {
    const d = newDeliverable({ title: "T".repeat(300), url: "u".repeat(900) });
    expect(d.status).toBe("draft");
    expect(d.title).toHaveLength(120);
    expect(d.url).toHaveLength(500);
    expect(d.id).toBeTruthy();
  });

  it("creates an open payment link, defaults EUR, rounds cents", () => {
    const l = newPaymentLink({
      label: "Deposit",
      url: "https://pay.stripe.com/x",
      amountCents: 12345.6,
    });
    expect(l.status).toBe("open");
    expect(l.currency).toBe("EUR");
    expect(l.amountCents).toBe(12346);
  });

  it("drops negative amounts", () => {
    const l = newPaymentLink({ label: "X", url: "https://x", amountCents: -5 });
    expect(l.amountCents).toBeUndefined();
  });
});

describe("applyClientResponse", () => {
  it("approves an in_review deliverable and stamps respondedAt", () => {
    const portal = makePortal({ deliverables: [makeDeliverable("in_review")] });
    const result = applyClientResponse(portal, "d1", "approve");
    expect(typeof result).not.toBe("string");
    const d = result as PortalDeliverable;
    expect(d.status).toBe("approved");
    expect(d.respondedAt).toBeTruthy();
  });

  it("records changes_requested with the client comment", () => {
    const portal = makePortal({ deliverables: [makeDeliverable("in_review")] });
    const result = applyClientResponse(portal, "d1", "request_changes", "Make the logo bigger");
    const d = result as PortalDeliverable;
    expect(d.status).toBe("changes_requested");
    expect(d.clientComment).toBe("Make the logo bigger");
  });

  it("rejects responses on drafts and already-approved deliverables", () => {
    const draft = makePortal({ deliverables: [makeDeliverable("draft")] });
    expect(typeof applyClientResponse(draft, "d1", "approve")).toBe("string");
    const approved = makePortal({ deliverables: [makeDeliverable("approved")] });
    expect(typeof applyClientResponse(approved, "d1", "approve")).toBe("string");
  });

  it("returns an error for unknown ids and portals without deliverables", () => {
    expect(typeof applyClientResponse(makePortal(), "nope", "approve")).toBe("string");
  });

  it("truncates oversized comments", () => {
    const portal = makePortal({ deliverables: [makeDeliverable("in_review")] });
    const result = applyClientResponse(portal, "d1", "request_changes", "x".repeat(5000));
    expect((result as PortalDeliverable).clientComment).toHaveLength(2000);
  });
});

describe("clientVisibleDeliverables", () => {
  it("hides drafts and shows everything else", () => {
    const portal = makePortal({
      deliverables: [
        { ...makeDeliverable("draft"), id: "a" },
        { ...makeDeliverable("in_review"), id: "b" },
        { ...makeDeliverable("approved"), id: "c" },
      ],
    });
    expect(clientVisibleDeliverables(portal).map((d) => d.id)).toEqual(["b", "c"]);
  });

  it("handles portals without a deliverables array", () => {
    expect(clientVisibleDeliverables(makePortal())).toEqual([]);
  });
});

describe("buildReportHtml", () => {
  it("includes steps, deliverables, open payments, and the portal link", () => {
    const portal = makePortal({
      deliverables: [{ ...makeDeliverable("in_review"), id: "b" }],
      paymentLinks: [
        {
          id: "p1",
          label: "Deposit",
          url: "https://pay.stripe.com/abc",
          amountCents: 50000,
          currency: "EUR",
          status: "open",
          createdAt: "2026-06-01T00:00:00Z",
        },
      ],
    });
    const html = buildReportHtml(portal);
    expect(html).toContain("Website Rebuild");
    expect(html).toContain("Audit");
    expect(html).toContain("Homepage design");
    expect(html).toContain("waiting for your review");
    expect(html).toContain("https://pay.stripe.com/abc");
    expect(html).toContain(`/portal/${portal.token}`);
  });

  it("escapes HTML in client-controlled fields", () => {
    const portal = makePortal({
      label: "<script>alert(1)</script>",
      deliverables: [],
    });
    const html = buildReportHtml(portal);
    expect(html).not.toContain("<script>");
  });

  it("omits the payments section when there are no open links", () => {
    const html = buildReportHtml(makePortal({ paymentLinks: [] }));
    expect(html).not.toContain("Open payments");
    expect(html).toContain("No deliverables shared yet");
  });
});
