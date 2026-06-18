import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getConfig } from "@/lib/ssm-config";
import { sendOrderConfirmation, sendPaymentFailureNotice, notifyTeam } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import { slackOrderNotify } from "@/lib/slack-notify";
import { recordNotification } from "@/lib/admin-notifications";
import { upsertContact, createDeal, associateDealWithContact } from "@/lib/hubspot";
import type Stripe from "stripe";
import { mapIntegrationError } from "@/lib/api-errors";
import {
  persistStripeEvent,
  markStripeEventProcessed,
  markStripeEventFailed,
} from "@/lib/stripe-transactions";

/**
 * Pull UTM fields out of the Stripe Checkout Session's `metadata` (the
 * checkout route stamps `utm_source / utm_medium / utm_campaign / utm_content
 * / utm_term` there when present), and return a human-readable one-liner
 * plus a `[k, v]` list. Empty if no UTM was carried through the click.
 */
function extractUtmFromSession(session: Stripe.Checkout.Session): {
  summary: string;
  entries: Array<[string, string]>;
} {
  const md = session.metadata ?? {};
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
  const entries: Array<[string, string]> = [];
  for (const k of keys) {
    const v = md[k];
    if (typeof v === "string" && v.length > 0) entries.push([k, v]);
  }
  // Campaign slug + tier travel in the same metadata bag — surface those too
  // so the email/Slack note shows "which paid offer was purchased."
  if (typeof md.campaign === "string" && md.campaign) entries.push(["campaign_slug", md.campaign]);
  if (typeof md.tier === "string" && md.tier) entries.push(["tier", md.tier]);
  return {
    summary: entries.map(([k, v]) => `${k}=${v}`).join(" | "),
    entries,
  };
}

async function syncHubSpotDeal(session: Stripe.Checkout.Session): Promise<void> {
  try {
    const amountEur = (session.amount_total ?? 0) / 100;
    const currency = (session.currency ?? "eur").toUpperCase();
    const { summary: utmSummary } = extractUtmFromSession(session);
    const contactId = await upsertContact({
      email: session.customer_email ?? "",
      firstname: session.customer_details?.name?.split(" ")[0] ?? "",
      lastname: session.customer_details?.name?.split(" ").slice(1).join(" ") ?? "",
      lead_source: "stripe_checkout",
    });
    const dealDescription = utmSummary
      ? `Stripe checkout session ${session.id}\nAttribution: ${utmSummary}`
      : `Stripe checkout session ${session.id}`;
    const dealId = await createDeal({
      dealname: `Purchase – ${session.id}`,
      amount: amountEur,
      currency,
      dealstage: "closedwon",
      lead_source: "stripe_checkout",
      description: dealDescription,
    });
    if (dealId && contactId) {
      await associateDealWithContact(dealId, contactId);
    }
  } catch (hubspotError) {
    console.error("[Stripe→HubSpot] Deal creation failed:", hubspotError);
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  _eventId: string
): Promise<void> {
  const paymentCollected = session.payment_status === "paid" || session.mode === "subscription";

  if (session.customer_email && paymentCollected) {
    await sendOrderConfirmation(
      session.customer_email,
      session.id,
      session.amount_total ?? 0,
      session.currency ?? "eur"
    );
  }

  const { summary: utmSummary, entries: utmEntries } = extractUtmFromSession(session);
  const utmHtml = utmSummary
    ? `<p><strong>Attribution:</strong> ${escapeHtml(utmSummary)}</p>`
    : "";

  await notifyTeam(
    `[Order] New purchase: ${session.id}`,
    `<h3>New order received</h3>
    <p><strong>Customer:</strong> ${escapeHtml(session.customer_email ?? "N/A")}</p>
    <p><strong>Amount:</strong> ${((session.amount_total ?? 0) / 100).toFixed(2)} ${escapeHtml((session.currency ?? "EUR").toUpperCase())}</p>
    <p><strong>Session:</strong> ${escapeHtml(session.id)}</p>
    ${utmHtml}`
  );

  slackOrderNotify({
    sessionId: session.id,
    email: session.customer_email ?? "N/A",
    amount: String((session.amount_total ?? 0) / 100),
    attribution: utmSummary || undefined,
  }).catch(() => {});

  recordNotification({
    category: "order",
    type: "success",
    title: `New order: €${((session.amount_total ?? 0) / 100).toFixed(2)}`,
    message: `${session.customer_email ?? "anonymous"} completed checkout (${session.id})`,
    actor: session.customer_email ?? undefined,
    route: "/api/webhooks/stripe",
    metadata: {
      sessionId: session.id,
      amountTotal: session.amount_total,
      currency: (session.currency ?? "eur").toUpperCase(),
      paymentStatus: session.payment_status,
      mode: session.mode,
      // First-touch attribution so the admin dashboard can filter conversions
      // by ad creative without having to round-trip back to Stripe.
      ...Object.fromEntries(utmEntries),
    },
  });

  if (session.customer_email) {
    syncHubSpotDeal(session).catch(() => {});
  }
}

function invoiceCustomerString(invoice: Stripe.Invoice): string {
  const c = invoice.customer;
  if (!c) return "unknown";
  if (typeof c === "string") return c;
  return c.id;
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.error(
    `[Stripe] Invoice payment failed: ${invoice.id}, customer: ${invoiceCustomerString(invoice)}`
  );
  const customerEmail = typeof invoice.customer_email === "string" ? invoice.customer_email : null;
  if (customerEmail) {
    await sendPaymentFailureNotice(customerEmail, invoice.id ?? "unknown");
  }
  await notifyTeam(
    `[Payment Failed] Invoice: ${invoice.id}`,
    `<p style="color: #ff4444;"><strong>Payment failed</strong></p>
    <p><strong>Invoice:</strong> ${escapeHtml(invoice.id ?? "unknown")}</p>
    <p><strong>Customer:</strong> ${escapeHtml(customerEmail ?? invoiceCustomerString(invoice))}</p>
    <p><strong>Amount:</strong> ${((invoice.amount_due ?? 0) / 100).toFixed(2)} ${escapeHtml((invoice.currency ?? "EUR").toUpperCase())}</p>`
  );
}

async function handleSubscriptionEvent(
  action: "created" | "updated" | "deleted",
  sub: Stripe.Subscription
): Promise<void> {
  if (action === "deleted") {
    console.warn(`[Stripe] Subscription cancelled: ${sub.id}`);
    await notifyTeam(
      `[Subscription] Cancelled: ${sub.id}`,
      `<p>Subscription cancelled.</p><p><strong>ID:</strong> ${escapeHtml(sub.id)}</p>`
    );
    return;
  }
  const label = action === "created" ? "New" : "Updated";
  const verb = action === "created" ? "created" : "updated";
  console.warn(`[Stripe] Subscription ${verb}: ${sub.id}, status: ${sub.status}`);
  await notifyTeam(
    `[Subscription] ${label}: ${sub.id}`,
    `<p>Subscription ${verb}.</p>
    <p><strong>ID:</strong> ${escapeHtml(sub.id)}</p>
    <p><strong>Status:</strong> ${escapeHtml(sub.status)}</p>`
  );
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, event.id);
      break;
    case "customer.subscription.created":
      await handleSubscriptionEvent("created", event.data.object);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionEvent("updated", event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionEvent("deleted", event.data.object);
      break;
    case "invoice.payment_succeeded":
      console.warn(
        `[Stripe] Invoice paid: ${event.data.object.id}, amount: ${event.data.object.amount_paid}`
      );
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object);
      break;
    default:
      console.warn(`[Stripe] Unhandled event type: ${event.type}`);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const config = await getConfig();
  const webhookSecret = config.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn("STRIPE_WEBHOOK_SECRET not configured — webhook disabled");
    return Response.json({ error: "Webhook not configured" }, { status: 401 });
  }

  let event: Stripe.Event;

  try {
    const stripe = await getStripe();
    if (!stripe) return Response.json({ error: "Stripe not configured" }, { status: 503 });
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const integrationResponse = mapIntegrationError(err);
    if (integrationResponse) return integrationResponse;
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${message}`);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const persistedEvent = await persistStripeEvent(event);
    if (persistedEvent.duplicate) {
      console.warn(`[Stripe] Duplicate event ignored: ${event.id}`);
      return Response.json({ received: true, duplicate: true });
    }
  } catch (err) {
    const integrationResponse = mapIntegrationError(err);
    if (integrationResponse) return integrationResponse;
    console.error("[Stripe] Failed to persist event for analytics:", err);
    return Response.json({ error: "Transaction persistence failed" }, { status: 500 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    const integrationResponse = mapIntegrationError(err);
    if (integrationResponse) return integrationResponse;

    const message = err instanceof Error ? err.message : "Unknown handler error";
    await markStripeEventFailed(event.id, message).catch((markErr) => {
      console.error("[Stripe] Failed to mark event as failed:", markErr);
    });

    console.error(`[Stripe] Error handling ${event.type}:`, err);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import("@sentry/nextjs")
        .then(({ captureException, withScope }) =>
          withScope((scope) => {
            scope.setTag("route", "stripe.webhook");
            scope.setTag("stripe.event", event.type);
            captureException(err);
          })
        )
        .catch(() => {});
    }
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  await markStripeEventProcessed(event.id).catch((markErr) => {
    console.error("[Stripe] Failed to mark event as processed:", markErr);
  });

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    await import("@sentry/nextjs").then(({ flush }) => flush(2000)).catch(() => {});
  }

  return Response.json({ received: true });
}
