import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  getAgencyProject,
  listUnbilledBillableEntries,
  markTimeEntriesInvoiced,
  setAgencyProjectStripeCustomer,
} from "@/lib/agency-projects-d1";
import {
  createDraftInvoice,
  getStripe,
  resolveOrCreateCustomerByEmail,
} from "@/lib/stripe";

const AP_RE = /^ap_[a-zA-Z0-9-]+$/;

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Create a Stripe draft invoice from unbilled billable hours.
 * Finalize/send stays on /admin/invoices.
 */
export async function POST(request: NextRequest, ctx: RouteCtx) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!AP_RE.test(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const { bound, project } = await getAgencyProject(id);
  if (!bound) {
    return NextResponse.json({ error: "AUTH_DB not configured" }, { status: 503 });
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.hourlyRateCents == null || project.hourlyRateCents < 1) {
    return NextResponse.json(
      { error: "Set an hourly rate on the project before billing" },
      { status: 400 }
    );
  }

  const { entries } = await listUnbilledBillableEntries(id);
  if (entries.length === 0) {
    return NextResponse.json({ error: "No unbilled billable hours" }, { status: 400 });
  }

  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const amountCents = Math.round((totalMinutes * project.hourlyRateCents) / 60);
  if (amountCents < 1) {
    return NextResponse.json({ error: "Computed amount is zero" }, { status: 400 });
  }

  let customerId = project.stripeCustomerId;
  if (!customerId) {
    if (!project.clientEmail) {
      return NextResponse.json(
        { error: "Client email or Stripe customer required on the project" },
        { status: 400 }
      );
    }
    const resolved = await resolveOrCreateCustomerByEmail(project.clientEmail);
    if (!resolved) {
      return NextResponse.json({ error: "Could not resolve Stripe customer" }, { status: 500 });
    }
    customerId = resolved;
    await setAgencyProjectStripeCustomer(id, customerId);
  }

  const hoursLabel = (totalMinutes / 60).toFixed(totalMinutes % 60 === 0 ? 0 : 1);
  const description = `${project.name} — ${hoursLabel}h @ ${(project.hourlyRateCents / 100).toFixed(2)} ${project.currency}/h`;

  try {
    const invoice = await createDraftInvoice({
      customerId,
      description,
      amountCents,
      currency: project.currency.toLowerCase(),
    });
    if (!invoice) {
      return NextResponse.json({ error: "Failed to create Stripe draft" }, { status: 500 });
    }

    const stamped = await markTimeEntriesInvoiced(
      entries.map((e) => e.id),
      invoice.id
    );

    return NextResponse.json(
      {
        invoice,
        stamped,
        totalMinutes,
        amountCents,
        entryCount: entries.length,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[delivery] invoice failed:", e);
    return NextResponse.json({ error: "Invoice creation failed" }, { status: 500 });
  }
}
