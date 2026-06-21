import { describe, it, expect } from "vitest";
import { buildReportHtml } from "@/lib/client-report-email";
import type { ClientPortal } from "@/lib/client-portals";

const SAMPLE: ClientPortal = {
  token: "tok-1",
  label: "Acme Migration",
  clientEmail: "ops@acme.example",
  clientName: "Acme",
  createdAt: "2026-01-01T00:00:00Z",
  steps: [
    { id: "s1", name: "Discovery", status: "completed", comments: [] },
    { id: "s2", name: "Build", status: "in-progress", comments: [] },
    { id: "s3", name: "Launch", status: "pending", comments: [] },
  ],
  deliverables: [
    {
      id: "d1",
      title: "Architecture diagram",
      url: "https://example.com/diagram",
      status: "approved",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "d2",
      title: "Cost model",
      status: "in_review",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "d3",
      title: "Internal draft",
      status: "draft",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ],
  paymentLinks: [
    {
      id: "p1",
      label: "Deposit",
      url: "https://stripe/deposit",
      amountCents: 50000,
      currency: "EUR",
      status: "open",
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "p2",
      label: "Paid invoice",
      url: "https://stripe/paid",
      status: "paid",
      createdAt: "2026-01-01T00:00:00Z",
    },
  ],
};

describe("client-report-email.buildReportHtml", () => {
  it("includes the portal label and a personalized greeting", () => {
    const html = buildReportHtml(SAMPLE);
    expect(html).toContain("Acme Migration");
    expect(html).toContain("Hi Acme");
  });

  it("renders every timeline step with its emoji", () => {
    const html = buildReportHtml(SAMPLE);
    expect(html).toContain("Discovery");
    expect(html).toContain("Build");
    expect(html).toContain("Launch");
    // Status-specific emojis
    expect(html).toContain("✅"); // completed
    expect(html).toContain("🔧"); // in-progress
    expect(html).toContain("⬜"); // pending
  });

  it("filters out draft deliverables", () => {
    const html = buildReportHtml(SAMPLE);
    expect(html).toContain("Architecture diagram");
    expect(html).toContain("Cost model");
    expect(html).not.toContain("Internal draft");
  });

  it("links titled deliverables that have a URL", () => {
    const html = buildReportHtml(SAMPLE);
    expect(html).toContain('href="https://example.com/diagram"');
    expect(html).toContain(">Architecture diagram<");
  });

  it("renders the 'in_review' status as a space-separated label", () => {
    const html = buildReportHtml(SAMPLE);
    expect(html).toContain("in review");
    expect(html).not.toContain(">in_review<");
  });

  it("flags how many deliverables are waiting for review", () => {
    const html = buildReportHtml(SAMPLE);
    expect(html).toMatch(/1 deliverable.* are waiting for your review/);
  });

  it("omits the review-waiting line when no deliverables are in_review", () => {
    const html = buildReportHtml({
      ...SAMPLE,
      deliverables: SAMPLE.deliverables?.filter((d) => d.status !== "in_review"),
    });
    expect(html).not.toMatch(/waiting for your review/);
  });

  it("lists only open payment links with formatted amount", () => {
    const html = buildReportHtml(SAMPLE);
    expect(html).toContain("Deposit");
    expect(html).toContain("500.00 EUR");
    expect(html).not.toContain("Paid invoice");
  });

  it("omits the payment section entirely when none are open", () => {
    const html = buildReportHtml({ ...SAMPLE, paymentLinks: [] });
    expect(html).not.toContain("Open payments");
  });

  it("renders a 'No deliverables shared yet' message when there are none visible", () => {
    const html = buildReportHtml({ ...SAMPLE, deliverables: [] });
    expect(html).toContain("No deliverables shared yet");
  });

  it("falls back to 'there' when clientName is empty", () => {
    const html = buildReportHtml({ ...SAMPLE, clientName: "" });
    expect(html).toContain("Hi there");
  });

  it("includes a link to the portal at /portal/<token>", () => {
    const html = buildReportHtml(SAMPLE);
    expect(html).toContain("/portal/tok-1");
  });

  it("escapes HTML in user-controlled fields", () => {
    const html = buildReportHtml({
      ...SAMPLE,
      label: "<script>alert(1)</script>",
      clientName: "<img onerror=x>",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img onerror=x>");
    expect(html).toContain("&lt;script&gt;");
  });
});
