import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import type { ClientPortal } from "@/app/api/admin/client-portals/route";

const SSM_KEY = "/cloudless/CLIENT_PORTALS_JSON";
const REGION = process.env.AWS_REGION ?? "eu-central-1";

async function resolvePortal(token: string): Promise<ClientPortal | null> {
  try {
    const client = new SSMClient({ region: REGION });
    const res = await client.send(new GetParameterCommand({ Name: SSM_KEY }));
    const portals: ClientPortal[] = JSON.parse(res.Parameter?.Value ?? "[]");
    return portals.find((p) => p.token === token) ?? null;
  } catch {
    return null;
  }
}

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const portal = await resolvePortal(token);
  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const cfg = await getConfig();

  // Fetch Stripe data for this client's email
  const stripeData = await safeCall(async () => {
    if (!cfg.STRIPE_SECRET_KEY) return null;
    const { getStripe } = await import("@/lib/stripe");
    const stripe = await getStripe();

    const customers = await stripe.customers.list({
      email: portal.clientEmail,
      limit: 1,
    });
    const customer = customers.data[0];
    if (!customer) return null;

    const [invoices, subs] = await Promise.all([
      stripe.invoices.list({
        customer: customer.id,
        limit: 10,
        status: "paid",
      }),
      stripe.subscriptions.list({
        customer: customer.id,
        limit: 5,
        expand: ["data.items.data.price.product"],
      }),
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

  // Fetch Notion projects
  const projects = await safeCall(async () => {
    if (!cfg.NOTION_API_KEY || !cfg.NOTION_PROJECTS_DB_ID) return null;
    const { listProjects } = await import("@/lib/notion-projects");
    return await listProjects();
  });

  return NextResponse.json({
    client: {
      name: portal.clientName || portal.clientEmail,
      email: portal.clientEmail,
      label: portal.label,
    },
    steps: portal.steps ?? [],
    projects: projects ?? [],
    invoices: stripeData?.invoices ?? [],
    subscriptions: stripeData?.subscriptions ?? [],
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
