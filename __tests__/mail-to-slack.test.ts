import { describe, expect, it } from "vitest";

import { classifyEmail } from "@/lib/mail-to-slack";

describe("mail-to-slack classifier", () => {
  it("routes known ops senders to the alert class", () => {
    const r = classifyEmail({
      from: "GitHub <notifications@github.com>",
      subject: "[cloudless.gr] Deploy failed",
      text: "Job failed at step 3",
    });
    expect(r.cls).toBe("alert");
    expect(r.channel).toContain("ops-alerts");
    expect(r.reasons).toContain("alert_sender:github.com");
  });

  it("escalates alert subjects from unknown senders", () => {
    const r = classifyEmail({
      from: "someone@random-vendor.example",
      subject: "Action required: payment failed",
      text: "Your card was declined",
    });
    expect(r.cls).toBe("alert");
    expect(r.reasons).toContain("alert_subject");
  });

  it("routes plain human mail to inbox", () => {
    const r = classifyEmail({
      from: "Sofia <sofia@example.com>",
      subject: "Quick question about the proposal",
      text: "Hey, can we move the meeting to Tuesday?",
    });
    expect(r.cls).toBe("human");
    expect(r.channel).toContain("inbox");
  });

  it("suppresses newsletter/bulk mail", () => {
    const r = classifyEmail({
      from: "news@marketing.example",
      subject: "This week's deals",
      text: "Great offers inside. Unsubscribe here.",
      list_id: "<list.marketing.example>",
    });
    expect(r.cls).toBe("bulk");
    expect(r.channel).toBe("");
    expect(r.reasons).toContain("bulk_markers");
  });

  it("suppresses RFC 3834 auto-generated mail", () => {
    const r = classifyEmail({
      from: "noreply@vendor.example",
      subject: "Your monthly statement",
      text: "Statement attached",
      auto_submitted: "auto-generated",
    });
    expect(r.cls).toBe("bulk");
  });

  it("alert sender beats unsubscribe footer in real ops mail", () => {
    // e.g. Stripe receipts carry unsubscribe links but must still alert
    const r = classifyEmail({
      from: "Stripe <receipts@stripe.com>",
      subject: "Your receipt from Cloudless",
      text: "Payment received. Manage preferences or unsubscribe.",
    });
    expect(r.cls).toBe("alert");
  });

  it("does not trust lookalike sender domains", () => {
    const r = classifyEmail({
      from: "alerts@fakestripe.com",
      subject: "Your receipt",
      text: "hello",
    });
    expect(r.reasons.some((x) => x.startsWith("alert_sender"))).toBe(false);
  });

  it("does trust subdomains of alert senders", () => {
    const r = classifyEmail({
      from: "noreply@mail.stripe.com",
      subject: "payout",
      text: "hello",
    });
    expect(r.reasons.some((x) => x.startsWith("alert_sender"))).toBe(true);
  });
});
