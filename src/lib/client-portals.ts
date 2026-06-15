/**
 * Client portals — shared store + types (Phase 3 of the one-stop-shop roadmap).
 *
 * Portals are stored in SSM under /cloudless/CLIENT_PORTALS_JSON as a JSON
 * array (same pattern as pending-clients). This module is the single owner of
 * that parameter; the admin route and the public token route both go through
 * it.
 *
 * Phase 3 additions on top of the original timeline (steps):
 *   - deliverables: links the client reviews and approves/requests changes on
 *   - paymentLinks: Stripe (or other) payment links attached to the project
 *   - reportsEnabled/lastReportAt: monthly status email opt-in + bookkeeping
 */

import { SSMClient, GetParameterCommand, PutParameterCommand } from "@aws-sdk/client-ssm";
import { randomUUID, timingSafeEqual } from "node:crypto";

const SSM_KEY = "/cloudless/CLIENT_PORTALS_JSON";
const REGION = process.env.AWS_REGION ?? "eu-central-1";

let ssm: SSMClient | null = null;
function getClient(): SSMClient {
  if (!ssm) ssm = new SSMClient({ region: REGION });
  return ssm;
}

export interface PortalComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface PortalStep {
  id: string;
  name: string;
  status: "pending" | "in-progress" | "completed" | "blocked";
  completedAt?: string;
  comments: PortalComment[];
}

export type DeliverableStatus = "draft" | "in_review" | "approved" | "changes_requested";

export interface PortalDeliverable {
  id: string;
  title: string;
  /** Link to the deliverable (Notion page, Figma, staging URL, S3 object, …). */
  url?: string;
  description?: string;
  status: DeliverableStatus;
  createdAt: string;
  updatedAt: string;
  /** Client feedback captured on approve / request-changes. */
  clientComment?: string;
  /** Set when the client acts on the deliverable. */
  respondedAt?: string;
}

export type PaymentLinkStatus = "open" | "paid" | "void";

export interface PortalPaymentLink {
  id: string;
  label: string;
  /** Stripe payment link / checkout URL the client pays through. */
  url: string;
  /** Display amount in cents. */
  amountCents?: number;
  currency?: string;
  status: PaymentLinkStatus;
  createdAt: string;
  paidAt?: string;
}

export interface ClientPortal {
  token: string;
  label: string;
  clientEmail: string;
  clientName: string;
  createdAt: string;
  steps: PortalStep[];
  deliverables?: PortalDeliverable[];
  paymentLinks?: PortalPaymentLink[];
  /** Monthly status email opt-in (cron client-reports). */
  reportsEnabled?: boolean;
  lastReportAt?: string;
}

/**
 * Coerce a stored record into a well-formed portal. Legacy/partial entries in
 * SSM (written before deliverables/paymentLinks existed, or hand-edited) can be
 * missing the array fields that scoreClientHealth and the admin route iterate
 * over. A missing `steps` array threw an unhandled TypeError that surfaced as a
 * 500 on GET /api/admin/client-portals. Normalizing on read is the single choke
 * point that guarantees every consumer sees the arrays it assumes.
 */
function normalizePortal(raw: ClientPortal): ClientPortal {
  const steps = Array.isArray(raw?.steps) ? raw.steps : [];
  return {
    ...raw,
    steps: steps.map((s) => ({ ...s, comments: Array.isArray(s?.comments) ? s.comments : [] })),
    deliverables: Array.isArray(raw?.deliverables) ? raw.deliverables : [],
    paymentLinks: Array.isArray(raw?.paymentLinks) ? raw.paymentLinks : [],
  };
}

export async function readPortals(): Promise<ClientPortal[]> {
  try {
    const res = await getClient().send(new GetParameterCommand({ Name: SSM_KEY }));
    const parsed: unknown = JSON.parse(res.Parameter?.Value ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => normalizePortal(p as ClientPortal));
  } catch {
    return [];
  }
}

export async function writePortals(portals: ClientPortal[]): Promise<void> {
  await getClient().send(
    new PutParameterCommand({
      Name: SSM_KEY,
      Value: JSON.stringify(portals),
      Type: "String",
      Overwrite: true,
    })
  );
}

/** Constant-time token comparison — the token is the portal's sole credential. */
export function tokenMatches(candidate: string, actual: string): boolean {
  try {
    const a = Buffer.from(actual);
    const b = Buffer.from(candidate);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function findPortalByToken(token: string): Promise<ClientPortal | null> {
  const portals = await readPortals();
  return portals.find((p) => tokenMatches(token, p.token)) ?? null;
}

export function newDeliverable(input: {
  title: string;
  url?: string;
  description?: string;
}): PortalDeliverable {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: input.title.slice(0, 120),
    url: input.url?.slice(0, 500),
    description: input.description?.slice(0, 1000),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function newPaymentLink(input: {
  label: string;
  url: string;
  amountCents?: number;
  currency?: string;
}): PortalPaymentLink {
  return {
    id: randomUUID(),
    label: input.label.slice(0, 120),
    url: input.url.slice(0, 500),
    amountCents:
      typeof input.amountCents === "number" && input.amountCents >= 0
        ? Math.round(input.amountCents)
        : undefined,
    currency: (input.currency ?? "EUR").slice(0, 3).toUpperCase(),
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Apply a client response to a deliverable. Returns the updated deliverable
 * or an error string. Only deliverables in "in_review" accept responses —
 * drafts aren't client-visible and approved ones are final.
 */
export function applyClientResponse(
  portal: ClientPortal,
  deliverableId: string,
  action: "approve" | "request_changes",
  comment?: string
): PortalDeliverable | string {
  const deliverable = portal.deliverables?.find((d) => d.id === deliverableId);
  if (!deliverable) return "Deliverable not found.";
  if (deliverable.status !== "in_review") {
    return "This deliverable is not awaiting review.";
  }
  deliverable.status = action === "approve" ? "approved" : "changes_requested";
  deliverable.clientComment = comment?.slice(0, 2000);
  deliverable.respondedAt = new Date().toISOString();
  deliverable.updatedAt = deliverable.respondedAt;
  return deliverable;
}

/** Deliverables visible to the client (drafts are internal). */
export function clientVisibleDeliverables(portal: ClientPortal): PortalDeliverable[] {
  return (portal.deliverables ?? []).filter((d) => d.status !== "draft");
}
