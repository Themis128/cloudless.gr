import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { randomUUID } from "node:crypto";
import {
  readPortals,
  writePortals,
  newDeliverable,
  newPaymentLink,
  type ClientPortal,
  type PortalStep,
  type DeliverableStatus,
  type PaymentLinkStatus,
} from "@/lib/client-portals";

import { scoreClientHealth } from "@/lib/client-health";

// Re-exported for existing imports (portal token route, admin pages).
export type { ClientPortal, PortalStep, PortalComment } from "@/lib/client-portals";

const DEFAULT_STEP_NAMES = [
  "Free Audit",
  "Proposal & Scope",
  "Setup & Kickoff",
  "Implementation",
  "Review & Feedback",
  "Delivery & Handoff",
];

function makeDefaultSteps(): PortalStep[] {
  return DEFAULT_STEP_NAMES.map((name) => ({
    id: randomUUID(),
    name,
    status: "pending",
    comments: [],
  }));
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const portals = await readPortals();
    // Computed, non-persisted health score per portal (Phase 4). readPortals
    // normalizes record shape, so scoring can't throw on legacy data — the
    // try/catch is defense-in-depth, matching the sibling admin routes.
    const withHealth = portals.map((p) => ({ ...p, health: scoreClientHealth(p) }));
    return NextResponse.json({ portals: withHealth });
  } catch (err) {
    console.error("[client-portals] GET failed:", err);
    return NextResponse.json({ error: "Failed to load client portals." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    label?: string;
    clientEmail?: string;
    clientName?: string;
    stepNames?: string[];
  };
  if (!body.clientEmail || !body.label) {
    return NextResponse.json({ error: "clientEmail and label are required" }, { status: 400 });
  }

  const portals = await readPortals();

  const portal: ClientPortal = {
    token: randomUUID(),
    label: String(body.label).slice(0, 100),
    clientEmail: String(body.clientEmail).slice(0, 200),
    clientName: String(body.clientName ?? "").slice(0, 200),
    createdAt: new Date().toISOString(),
    steps: body.stepNames?.length
      ? body.stepNames.slice(0, 12).map((name) => ({
          id: randomUUID(),
          name: String(name).slice(0, 80),
          status: "pending" as const,
          comments: [],
        }))
      : makeDefaultSteps(),
    deliverables: [],
    paymentLinks: [],
  };

  portals.push(portal);
  await writePortals(portals);

  return NextResponse.json({ portal }, { status: 201 });
}

type PatchAction =
  | {
      token: string;
      action: "update-step";
      stepId: string;
      status: PortalStep["status"];
    }
  | {
      token: string;
      action: "add-comment";
      stepId: string;
      author: string;
      text: string;
    }
  | {
      token: string;
      action: "delete-comment";
      stepId: string;
      commentId: string;
    }
  | { token: string; action: "add-step"; name: string }
  | { token: string; action: "delete-step"; stepId: string }
  | { token: string; action: "rename-step"; stepId: string; name: string }
  | {
      token: string;
      action: "add-deliverable";
      title: string;
      url?: string;
      description?: string;
    }
  | {
      token: string;
      action: "update-deliverable";
      deliverableId: string;
      status?: DeliverableStatus;
      title?: string;
      url?: string;
      description?: string;
    }
  | { token: string; action: "delete-deliverable"; deliverableId: string }
  | {
      token: string;
      action: "add-payment-link";
      label: string;
      url: string;
      amountCents?: number;
      currency?: string;
    }
  | {
      token: string;
      action: "update-payment-link";
      paymentLinkId: string;
      status: PaymentLinkStatus;
    }
  | { token: string; action: "delete-payment-link"; paymentLinkId: string }
  | { token: string; action: "set-reports-enabled"; enabled: boolean };

function stepNotFound() {
  return NextResponse.json({ error: "Step not found" }, { status: 404 });
}

function applyUpdateStep(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "update-step" }>
): NextResponse | null {
  const step = portal.steps.find((s) => s.id === body.stepId);
  if (!step) return stepNotFound();
  step.status = body.status;
  if (body.status === "completed" && !step.completedAt) {
    step.completedAt = new Date().toISOString();
  } else if (body.status !== "completed") {
    delete step.completedAt;
  }
  return null;
}

function applyAddComment(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "add-comment" }>
): NextResponse | null {
  const step = portal.steps.find((s) => s.id === body.stepId);
  if (!step) return stepNotFound();
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "Comment text required" }, { status: 400 });
  }
  step.comments.push({
    id: randomUUID(),
    author: String(body.author || "Cloudless Team").slice(0, 80),
    text: String(body.text).slice(0, 2000),
    createdAt: new Date().toISOString(),
  });
  return null;
}

function applyDeleteComment(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "delete-comment" }>
): NextResponse | null {
  const step = portal.steps.find((s) => s.id === body.stepId);
  if (!step) return stepNotFound();
  step.comments = step.comments.filter((c) => c.id !== body.commentId);
  return null;
}

function applyAddStep(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "add-step" }>
): NextResponse | null {
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Step name required" }, { status: 400 });
  }
  portal.steps.push({
    id: randomUUID(),
    name: String(body.name).slice(0, 80),
    status: "pending",
    comments: [],
  });
  return null;
}

function applyRenameStep(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "rename-step" }>
): NextResponse | null {
  const step = portal.steps.find((s) => s.id === body.stepId);
  if (!step) return stepNotFound();
  step.name = String(body.name).slice(0, 80);
  return null;
}

function applyAddDeliverable(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "add-deliverable" }>
): NextResponse | null {
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Deliverable title required" }, { status: 400 });
  }
  portal.deliverables ??= [];
  portal.deliverables.push(
    newDeliverable({ title: body.title, url: body.url, description: body.description })
  );
  return null;
}

function applyUpdateDeliverable(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "update-deliverable" }>
): NextResponse | null {
  const deliverable = portal.deliverables?.find((d) => d.id === body.deliverableId);
  if (!deliverable) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }
  if (body.status) deliverable.status = body.status;
  if (body.title?.trim()) deliverable.title = body.title.slice(0, 120);
  if (body.url !== undefined) deliverable.url = body.url.slice(0, 500) || undefined;
  if (body.description !== undefined) {
    deliverable.description = body.description.slice(0, 1000) || undefined;
  }
  deliverable.updatedAt = new Date().toISOString();
  return null;
}

function applyAddPaymentLink(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "add-payment-link" }>
): NextResponse | null {
  if (!body.label?.trim() || !body.url?.trim()) {
    return NextResponse.json({ error: "label and url are required" }, { status: 400 });
  }
  portal.paymentLinks ??= [];
  portal.paymentLinks.push(
    newPaymentLink({
      label: body.label,
      url: body.url,
      amountCents: body.amountCents,
      currency: body.currency,
    })
  );
  return null;
}

function applyUpdatePaymentLink(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "update-payment-link" }>
): NextResponse | null {
  const link = portal.paymentLinks?.find((l) => l.id === body.paymentLinkId);
  if (!link) return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  link.status = body.status;
  if (body.status === "paid" && !link.paidAt) {
    link.paidAt = new Date().toISOString();
  } else if (body.status !== "paid") {
    delete link.paidAt;
  }
  return null;
}

function dispatchPatch(portal: ClientPortal, body: PatchAction): NextResponse | null {
  switch (body.action) {
    case "update-step":
      return applyUpdateStep(portal, body);
    case "add-comment":
      return applyAddComment(portal, body);
    case "delete-comment":
      return applyDeleteComment(portal, body);
    case "add-step":
      return applyAddStep(portal, body);
    case "delete-step":
      portal.steps = portal.steps.filter((s) => s.id !== body.stepId);
      return null;
    case "rename-step":
      return applyRenameStep(portal, body);
    case "add-deliverable":
      return applyAddDeliverable(portal, body);
    case "update-deliverable":
      return applyUpdateDeliverable(portal, body);
    case "delete-deliverable":
      portal.deliverables = (portal.deliverables ?? []).filter((d) => d.id !== body.deliverableId);
      return null;
    case "add-payment-link":
      return applyAddPaymentLink(portal, body);
    case "update-payment-link":
      return applyUpdatePaymentLink(portal, body);
    case "delete-payment-link":
      portal.paymentLinks = (portal.paymentLinks ?? []).filter((l) => l.id !== body.paymentLinkId);
      return null;
    case "set-reports-enabled":
      portal.reportsEnabled = Boolean(body.enabled);
      return null;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as PatchAction;
  if (!body.token || !body.action) {
    return NextResponse.json({ error: "token and action are required" }, { status: 400 });
  }

  const portals = await readPortals();
  const idx = portals.findIndex((p) => p.token === body.token);
  if (idx === -1) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const portal = portals[idx];
  const errorResponse = dispatchPatch(portal, body);
  if (errorResponse) return errorResponse;

  portals[idx] = portal;
  await writePortals(portals);
  return NextResponse.json({ portal });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { token } = (await request.json()) as { token?: string };
  if (!token) return NextResponse.json({ error: "token is required" }, { status: 400 });

  const portals = await readPortals();
  const updated = portals.filter((p) => p.token !== token);
  await writePortals(updated);

  return NextResponse.json({ ok: true });
}
