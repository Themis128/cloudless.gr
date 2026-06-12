/**
 * Monthly client status email — HTML builder.
 * Separate from the cron route so it can be unit-tested (Next.js route files
 * may only export handlers).
 */

import { clientVisibleDeliverables, type ClientPortal } from "@/lib/client-portals";
import { escapeHtml } from "@/lib/escape-html";

const BASE_URL = "https://cloudless.gr";

const STEP_EMOJI: Record<string, string> = {
  completed: "✅",
  "in-progress": "🔧",
  pending: "⬜",
  blocked: "⛔",
};

function formatAmount(cents: number | undefined, currency: string | undefined): string {
  if (typeof cents !== "number") return "";
  return ` — ${(cents / 100).toFixed(2)} ${currency ?? "EUR"}`;
}

export function buildReportHtml(portal: ClientPortal): string {
  const stepsHtml = portal.steps
    .map(
      (s) =>
        `<li>${STEP_EMOJI[s.status] ?? "⬜"} ${escapeHtml(s.name)} — <em>${escapeHtml(s.status)}</em></li>`
    )
    .join("");

  const deliverables = clientVisibleDeliverables(portal);
  const inReview = deliverables.filter((d) => d.status === "in_review");
  const deliverablesHtml = deliverables.length
    ? deliverables
        .map((d) => {
          const title = d.url
            ? `<a href="${escapeHtml(d.url)}">${escapeHtml(d.title)}</a>`
            : escapeHtml(d.title);
          return `<li>${title} — <em>${escapeHtml(d.status.replace("_", " "))}</em></li>`;
        })
        .join("")
    : "<li>No deliverables shared yet.</li>";

  const openPayments = (portal.paymentLinks ?? []).filter((l) => l.status === "open");
  const paymentsHtml = openPayments
    .map(
      (l) =>
        `<li><a href="${escapeHtml(l.url)}">${escapeHtml(l.label)}</a>${formatAmount(l.amountCents, l.currency)}</li>`
    )
    .join("");

  const portalUrl = `${BASE_URL}/portal/${portal.token}`;

  return [
    `<h2>Project status — ${escapeHtml(portal.label)}</h2>`,
    `<p>Hi ${escapeHtml(portal.clientName || "there")}, here is your monthly status update.</p>`,
    `<h3>Timeline</h3><ul>${stepsHtml}</ul>`,
    `<h3>Deliverables</h3><ul>${deliverablesHtml}</ul>`,
    inReview.length
      ? `<p><strong>${inReview.length} deliverable(s) are waiting for your review.</strong></p>`
      : "",
    openPayments.length ? `<h3>Open payments</h3><ul>${paymentsHtml}</ul>` : "",
    `<p><a href="${portalUrl}">Open your project portal →</a></p>`,
    `<p style="color:#888;font-size:12px">Cloudless — cloudless.gr</p>`,
  ]
    .filter(Boolean)
    .join("\n");
}
