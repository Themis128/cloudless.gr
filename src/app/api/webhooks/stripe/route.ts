import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getConfig } from "@/lib/ssm-config";
import {
  sendOrderConfirmation,
  sendPaymentFailureNotice,
  notifyTeam,
} from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import { slackOrderNotify } from "@/lib/slack-notify";
import {
  upsertContact,
  createDeal,
  associateDealWithContact,
} from "@/lib/hubspot";
import type Stripe from "stripe";
import { mapIntegrationError } from "@/lib/api-errors";
import {
  persistStripeEvent,
  markStripeEventProcessed,
  markStripeEventFailed,
} from "@/lib/stripe-transactions";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const config = await getConfig();
  const webhookSecret = config.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured in SSM");
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const stripe = await getStripe();
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
    return Response.json(
      { error: "Transaction persistence failed" },
      { status: 500 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.warn(
          `[Stripe] Checkout completed: ${session.id}, event: ${event.id}, payment_status: ${session.payment_status}`,
        );

        const paymentCollected =
          session.payment_status === "paid" || session.mode === "subscription";

        if (session.customer_email && paymentCollected) {
          await sendOrderConfirmation(
            session.customer_email,
            session.id,
            session.amount_total ?? 0,
            session.currency ?? "eur",
          );
        }

        await notifyTeam(
          `[Order] New purchase: ${session.id}`,
          `<h3>New order received</h3>
          <p><strong>Customer:</strong> ${escapeHtml(session.customer_email ?? "N/A")}</p>
          <p><strong>Amount:</strong> ${((session.amount_total ?? 0) / 100).toFixed(2)} ${escapeHtml((session.currency ?? "EUR").toUpperCase())}</p>
          <p><strong>Session:</strong> ${escapeHtml(session.id)}</p>`,
        );

        slackOrderNotify({
          sessionId: session.id,
          email: session.customer_email ?? "N/A",
          amount: String((session.amount_total ?? 0) / 100),
        }).catch(() => {});

        if (session.customer_email) {
          (async () => {
            try {
              const amountEur = (session.amount_total ?? 0) / 100;
              const currency = (session.currency ?? "eur").toUpperCase();
              const contactId = await upsertContact({
                email: session.customer_email!,
                firstname: session.customer_details?.name?.split(" ")[0] ?? "",
                lastname:
                  session.customer_details?.name
                    ?.split(" ")
                    .slice(1)
                    .join(" ") ?? "",
                lead_source: "stripe_checkout",
              });
              const dealId = await createDeal({
                dealname: `Purchase – ${session.id}`,
                amount: amountEur,
                currency,
                dealstage: "closedwon",
                lead_source: "stripe_checkout",
                description: `Stripe checkout session ${session.id}`,
              });
              if (dealId && contactId) {
                await associateDealWithContact(dealId, contactId);
              }
            } catch (hubspotError) {
              console.error("[Stripe→HubSpot] Deal creation failed:", hubspotError);
            }
          })();
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        console.warn(
          `[Stripe] Subscription created: ${subscription.id}, status: ${subscription.status}`,
        );

        await notifyTeam(
          `[Subscription] New: ${subscription.id}`,
          `<p>New subscription created.</p>
          <p><strong>ID:</strong> ${escapeHtml(subscription.id)}</p>
          <p><strong>Status:</strong> ${escapeHtml(subscription.status)}</p>`,
        );
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.warn(
          `[Stripe] Subscription updated: ${subscription.id}, status: ${subscription.status}`,
        );

        await notifyTeam(
          `[Subscription] Updated: ${subscription.id}`,
          `<p>Subscription updated.</p>
          <p><strong>ID:</strong> ${escapeHtml(subscription.id)}</p>
          <p><strong>Status:</strong> ${escapeHtml(subscription.status)}</p>`,
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.warn(`[Stripe] Subscription cancelled: ${subscription.id}`);

        await notifyTeam(
          `[Subscription] Cancelled: ${subscription.id}`,
          `<p>Subscription cancelled.</p>
          <p><strong>ID:</strong> ${escapeHtml(subscription.id)}</p>`,
        );
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(
          `[Stripe] Invoice paid: ${invoice.id}, amount: ${invoice.amount_paid}`,
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.error(
          `[Stripe] Invoice payment failed: ${invoice.id}, customer: ${invoice.customer}`,
        );

        const customerEmail =
          typeof invoice.customer_email === "string"
            ? invoice.customer_email
            : null;

        if (customerEmail) {
          await sendPaymentFailureNotice(customerEmail, invoice.id ?? "unknown");
        }

        await notifyTeam(
          `[Payment Failed] Invoice: ${invoice.id}`,
          `<p style="color: #ff4444;"><strong>Payment failed</strong></p>
          <p><strong>Invoice:</strong> ${escapeHtml(invoice.id ?? "unknown")}</p>
          <p><strong>Customer:</strong> ${escapeHtml(customerEmail ?? String(invoice.customer))}</p>
          <p><strong>Amount:</strong> ${((invoice.amount_due ?? 0) / 100).toFixed(2)} ${escapeHtml((invoice.currency ?? "EUR").toUpperCase())}</p>`,
        );
        break;
      }

      default:
        console.warn(`[Stripe] Unhandled event type: ${event.type}`);
    }
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
          }),
        )
        .catch(() => {});
    }
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  await markStripeEventProcessed(event.id).catch((markErr) => {
    console.error("[Stripe] Failed to mark event as processed:", markErr);
  });

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    await import("@sentry/nextjs")
      .then(({ flush }) => flush(2000))
      .catch(() => {});
  }

  return Response.json({ received: true });
}
