/**
 * Contact360View — empty / sparse states for every section, score bands,
 * Stripe configured/customer/purchases states, match-hint diagnostics, and
 * date/money fallbacks. Pure render component: no mocks beyond the i18n Link.
 *
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { Contact360View } from "@/components/admin/Contact360View";

const hints = (extra: Record<string, unknown> = {}) => ({
  summary: "Joined on email",
  hasEmail: true,
  d1User: "matched",
  stripeCustomer: "matched",
  d1Events: "3 events",
  rfmScores: "matched",
  attribution: "gold",
  ...extra,
});

function base(extra: Record<string, unknown> = {}) {
  return {
    contact: { id: "c1", email: "", firstName: "", lastName: "" },
    opportunities: [],
    cases: [],
    notes: [],
    events: [],
    stripe: { configured: false, customer: null, purchases: [], subscriptions: [] },
    account: null,
    attribution: { firstTouch: null, goldMatches: [] },
    scores: {},
    matchHints: hints({ hasEmail: false, summary: "No email" }),
    fetchedAt: "t",
    ...extra,
  } as never;
}

const section = (title: string) =>
  screen.getByRole("heading", { name: title }).closest("section, div") as HTMLElement;

describe("Contact360View", () => {
  afterEach(() => cleanup());

  it("all-empty contact: every section shows its empty copy", () => {
    const { container } = render(<Contact360View data={base()} />);
    const t = container.textContent!;
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("—");
    expect(t).toContain("No email");
    expect(t).toContain("Add a primary email on the Espo contact to enable joins");
    expect(t).toContain("No UTM match for this email in D1 or gold attribution");
    expect(t).toContain("No RFM/churn row for this email in gold parquet");
    expect(t).toContain("No D1 user with this email");
    expect(t).toContain("Stripe not configured");
    expect(t).toContain("No opportunities");
    expect(t).toContain("No cases");
    expect(t).toContain("No stream notes");
    expect(t).toContain("No D1 events for this email");
    expect(t).not.toContain("Description");
    // company / phone / lead source fall back to dashes
    for (const label of ["Company", "Phone", "Lead source"]) {
      expect(screen.getByText(label).nextElementSibling!.textContent).toBe("—");
    }
    expect(screen.getByText("← Contacts").getAttribute("href")).toBe("/admin/crm");
  });

  it("match hints list every join state", () => {
    render(<Contact360View data={base({ matchHints: hints() })} />);
    const s = section("Email join diagnostics");
    expect(s.textContent).toContain("Joined on email");
    for (const [label, state] of [
      ["D1 user", "matched"],
      ["D1 events", "3 events"],
      ["Attribution", "gold"],
    ]) {
      expect(within(s).getByText(label).nextElementSibling!.textContent).toBe(state);
    }
    expect(s.textContent).not.toContain("Add a primary email");
  });

  it("sparse rows fall back to dashes, 'direct' and '(none)' labels", () => {
    render(
      <Contact360View
        data={base({
          contact: { id: "c1", email: "e@x.co" },
          opportunities: [
            { id: "o1", name: "", status: "", amount: null, createdAt: "not a date" },
          ],
          notes: [{ id: "n1", post: "", createdAt: null }],
          events: [{ id: "e1", event: "signup", page: "", source: "", date: "" }],
          attribution: { firstTouch: { source: "", medium: "", campaign: "" }, goldMatches: [] },
        })}
      />
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("e@x.co");
    expect(section("Opportunities").textContent).toBe("Opportunities—— · ——");
    expect(section("Notes").textContent).toBe("Notes——");
    expect(section("D1 events").textContent).toContain("— · direct");
    const attr = section("Attribution").textContent!;
    expect(attr).toContain("First touch: (direct) / (none) / (none)");
    expect(attr).toContain("No matching gold attribution row");
  });

  it("gold matches without a first touch render only the table", () => {
    render(
      <Contact360View
        data={base({
          attribution: {
            firstTouch: null,
            goldMatches: [
              { utmSource: "li", utmMedium: "paid", utmCampaign: "q4", sessions: 7, purchases: 2 },
            ],
          },
        })}
      />
    );
    const attr = section("Attribution").textContent!;
    expect(attr).not.toContain("First touch");
    expect(attr).toContain("li · paid · q4");
    expect(attr).toContain("7 sess · 2 buy");
  });

  it.each([
    [{ churnScore: 0.756 }, "—", "text-neon-green", "0.76"],
    [{ riskBand: "at_risk" }, "at_risk", "text-neon-magenta", "—"],
    [{ riskBand: "high", frequency: 0 }, "high", "text-neon-magenta", "—"],
    [{ riskBand: "medium", monetary: 0 }, "medium", "text-yellow-400", "—"],
  ])("scores %j → band %s", (scores, band, cls, churn) => {
    render(<Contact360View data={base({ scores })} />);
    const s = section("RFM / churn");
    const risk = within(s).getByText("Risk").nextElementSibling!;
    expect(risk.textContent).toBe(band);
    expect(risk.className).toContain(cls);
    expect(within(s).getByText("Churn").nextElementSibling!.textContent).toBe(churn);
    expect(within(s).getByText("RFM").nextElementSibling!.textContent).toBe("—");
    expect(within(s).getByText("Recency").nextElementSibling!.textContent).toBe("—");
    expect(within(s).getByText("Last purchase").nextElementSibling!.textContent).toBe("—");
  });

  it("scores with only a frequency or monetary value still render the grid", () => {
    render(<Contact360View data={base({ scores: { frequency: 4 } })} />);
    expect(
      within(section("RFM / churn")).getByText("Frequency").nextElementSibling!.textContent
    ).toBe("4");
    cleanup();
    render(<Contact360View data={base({ scores: { monetary: 12.5 } })} />);
    expect(
      within(section("RFM / churn")).getByText("Monetary").nextElementSibling!.textContent
    ).toMatch(/12\.50/);
  });

  it("Stripe: configured without customer; customer without purchases or subscriptions", () => {
    render(
      <Contact360View
        data={base({
          stripe: { configured: true, customer: null, purchases: [], subscriptions: [] },
        })}
      />
    );
    expect(section("Stripe").textContent).toContain("No Stripe customer for this email");
    cleanup();
    render(
      <Contact360View
        data={base({
          stripe: { configured: true, customer: { id: "cus_9" }, purchases: [], subscriptions: [] },
        })}
      />
    );
    const s = section("Stripe").textContent!;
    expect(s).toContain("cus_9");
    expect(s).toContain("No checkout sessions");
    expect(s).not.toContain(" · active");
  });

  it("D1 account without a name shows the email", () => {
    render(
      <Contact360View
        data={base({ account: { id: "a", email: "acct@x.co", name: "", createdAt: null } })}
      />
    );
    const s = section("D1 account");
    expect(within(s).getByText("User").nextElementSibling!.textContent).toBe("acct@x.co");
    expect(within(s).getByText("Created").nextElementSibling!.textContent).toBe("—");
  });
});
