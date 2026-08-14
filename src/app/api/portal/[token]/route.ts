import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { findPortalByToken, clientVisibleDeliverables } from "@/lib/client-portals";

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Rate limit by IP. The portal token is the sole credential, so this caps
  // token-enumeration / scraping attempts. 30/min is generous for the UI's
  // own polling while still bounding abuse.
  const rl = rateLimit(`portal:${getClientIp(request)}`, 30, 60_000);
  if (!rl.ok) return rl.response;

  const { token } = await params;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const portal = await findPortalByToken(token);
  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const cfg = await getConfig();

  // Fetch Stripe data for this client's email
  const stripeData = await safeCall(async () => {
    if (!cfg.STRIPE_SECRET_KEY) return null;
    const { getStripe } = await import("@/lib/stripe");
    const stripe = await getStripe();
    if (!stripe) return null;

    const customers = await stripe.customers.list(
      { email: portal.clientEmail, limit: 1 },
      { timeout: 10_000 },
    );
    const customer = customers.data[0];
    if (!customer) return null;

    const [invoices, subs] = await Promise.all([
      stripe.invoices.list(
        { customer: customer.id, limit: 10, status: "paid" },
        { timeout: 10_000 },
      ),
      stripe.subscriptions.list(
        { customer: customer.id, limit: 5, expand: ["data.items.data.price.product"] },
        { timeout: 10_000 },
      ),
    ]);

    return {
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        amount: inv.amount_paid,
        currency: (inv.currency ?? "eur").toUpperCase(),
        status: inv.status,
        created: inv.created,
        pdfUrl: inv.invoice_pdf,
      })),
      subscriptions: subs.data.map((sub) => {
        const item = sub.items.data[0];
        const product = item?.price?.product as { name?: string } | null;
        const subRecord = sub as unknown as Record<string, number>;
        return {
          id: sub.id,
          status: sub.status,
          planName: product?.name ?? item?.price?.nickname ?? "Plan",
          amount: item?.price?.unit_amount ?? 0,
          currency: (item?.price?.currency ?? "eur").toUpperCase(),
          interval: item?.price?.recurring?.interval ?? "month",
          currentPeriodEnd: subRecord.current_period_end ?? 0,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        };
      }),
    };
  });

  // Fetch AppFlowy projects scoped to this client.
  // listProjects() returns all projects; filter client-type ones whose owner
  // matches the portal email so other clients' data is never returned.
  const projects = await safeCall(async () => {
    const { isAppFlowyConfigured } = await import("@/lib/appflowy");
    if (!(await isAppFlowyConfigured())) return null;
    const { listProjects } = await import("@/lib/appflowy-projects");
    const all = await listProjects();
    const clientEmail = portal.clientEmail.toLowerCase();
    return all.filter(
      (p) => p.type === "Client" && p.owner.toLowerCase() === clientEmail
    );
  });

  return NextResponse.json({
    client: {
      name: portal.clientName || portal.clientEmail,
      email: portal.clientEmail,
      label: portal.label,
    },
    steps: portal.steps ?? [],
    deliverables: clientVisibleDeliverables(portal),
    paymentLinks: portal.paymentLinks ?? [],
    projects: projects ?? [],
    invoices: stripeData?.invoices ?? [],
    subscriptions: stripeData?.subscriptions ?? [],
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
