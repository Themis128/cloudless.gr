import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  createDraftInvoice,
  getStripe,
  listRecentInvoices,
  resolveOrCreateCustomerByEmail,
  type AdminInvoiceSummary,
} from "@/lib/stripe";

export type { AdminInvoiceSummary };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUS_RE = /^cus_[a-zA-Z0-9]+$/;
const INV_RE = /^in_[a-zA-Z0-9]+$/;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const stripe = await getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "all";
    const limit = Math.min(Number(searchParams.get("limit") ?? "50") || 50, 50);
    const { invoices, hasMore } = await listRecentInvoices(
      limit,
      status === "all" ? undefined : status
    );
    return NextResponse.json({ invoices, hasMore, total: invoices.length });
  } catch (e) {
    console.error("[Stripe] Error fetching invoices:", e);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  try {
    if (action === "create") {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const customerIdRaw = typeof body.customerId === "string" ? body.customerId.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
      const amountEur = Number(body.amountEur);
      const amountCents =
        typeof body.amountCents === "number"
          ? Math.round(body.amountCents)
          : Number.isFinite(amountEur)
            ? Math.round(amountEur * 100)
            : 0;

      if (!description || amountCents < 1) {
        return NextResponse.json(
          { error: "description and positive amount required" },
          { status: 400 }
        );
      }

      let customerId = customerIdRaw;
      if (customerId) {
        if (!CUS_RE.test(customerId)) {
          return NextResponse.json({ error: "Invalid customerId format" }, { status: 400 });
        }
      } else {
        if (!EMAIL_RE.test(email)) {
          return NextResponse.json({ error: "Valid email or customerId required" }, { status: 400 });
        }
        const resolved = await resolveOrCreateCustomerByEmail(email);
        if (!resolved) {
          return NextResponse.json({ error: "Could not resolve Stripe customer" }, { status: 500 });
        }
        customerId = resolved;
      }

      const invoice = await createDraftInvoice({
        customerId,
        description,
        amountCents,
      });
      if (!invoice) {
        return NextResponse.json({ error: "Failed to create draft invoice" }, { status: 500 });
      }
      return NextResponse.json({ invoice }, { status: 201 });
    }

    const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId.trim() : "";
    if (!INV_RE.test(invoiceId)) {
      return NextResponse.json({ error: "Invalid invoiceId format" }, { status: 400 });
    }

    if (action === "finalize") {
      const inv = await stripe.invoices.finalizeInvoice(invoiceId);
      return NextResponse.json({
        invoice: {
          id: inv.id,
          status: inv.status,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        },
      });
    }

    if (action === "send") {
      const inv = await stripe.invoices.sendInvoice(invoiceId);
      return NextResponse.json({
        invoice: {
          id: inv.id,
          status: inv.status,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("[Stripe] Invoice action failed:", e);
    return NextResponse.json({ error: "Invoice action failed" }, { status: 500 });
  }
}
