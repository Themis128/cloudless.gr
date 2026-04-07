import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getConfig } from "@/lib/ssm-config";
import { sendOrderConfirmation, sendPaymentFailureNotice, notifyTeam } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import { slackOrderNotify } from "@/lib/slack-notify";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
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
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${message}`);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.warn(
          `[Stripe] Checkout completed: ${session.id}, customer: ${session.customer_email}`,
        );

        // Send order confirmation to customer
        if (session.customer_email) {
          await sendOrderConfirmation(
            session.customer_email,
            session.id,
            session.amount_total ?? 0,
            session.currency ?? "eur",
          );
        }

        // Notify the team
        await notifyTeam(
          `[Order] New purchase: ${session.id}`,
          `<h3>New order received</h3>
          <p><strong>Customer:</strong> ${escapeHtml(session.customer_email ?? "N/A")}</p>
          <p><strong>Amount:</strong> ${((session.amount_total ?? 0) / 100).toFixed(2)} ${escapeHtml((session.currency ?? "EUR").toUpperCase())}</p>
          <p><strong>Session:</strong> ${escapeHtml(session.id)}</p>`,
        );

        // Fire-and-forget Slack notification
        slackOrderNotify({
          sessionId: session.id,
          email: session.customer_email ?? "N/A",
          amount: (session.amount_total ?? 0) / 100,
          currency: (session.currency ?? "EUR").toUpperCase(),
        }).catch(() => {});
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
        console.warn(`[Stripe] Invoice paid: ${invoice.id}, amount: ${invoice.amount_paid}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.error(
          `[Stripe] Invoice payment failed: ${invoice.id}, customer: ${invoice.customer}`,
        );

        // Notify the customer about the failed payment
        const customerEmail =
          typeof invoice.customer_email === "string" ? invoice.customer_email : null;

        if (customerEmail) {
          await sendPaymentFailureNotice(customerEmail, invoice.id ?? "unknown");
        }

        // Notify the team
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
    console.error(`[Stripe] Error handling ${event.type}:`, err);
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
