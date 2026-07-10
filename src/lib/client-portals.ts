/**
 * Client portals — shared store + types (Phase 3 of the one-stop-shop roadmap).
 *
 * D1 primary (Cloudflare Workers) + SSM fallback (AWS Lambda).
 * D1: config table with key "CLIENT_PORTALS_JSON"
 * SSM legacy: /cloudless/CLIENT_PORTALS_JSON
 *
 * Portals are stored as a JSON array in D1 config table (same pattern as SSM).
 * This module is the single owner of that parameter; the admin route and the
 * public token route both go through it.
 *
 * Phase 3 additions on top of the original timeline (steps):
 *   - deliverables: links the client reviews and approves/requests changes on
 *   - paymentLinks: Stripe (or other) payment links attached to the project
 *   - reportsEnabled/lastReportAt: monthly status email opt-in + bookkeeping
 */

import { SSMClient, GetParameterCommand, PutParameterCommand } from "@aws-sdk/client-ssm";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { AuthDatabase } from "@/lib/auth-d1";

const SSM_KEY = "/cloudless/CLIENT_PORTALS_JSON";
const D1_KEY = "CLIENT_PORTALS_JSON";
const REGION = process.env.AWS_REGION ?? "eu-central-1";

let ssm: SSMClient | null = null;
function getSsmClient(): SSMClient {
  if (!ssm) ssm = new SSMClient({ region: REGION });
  return ssm;
}

// D1 binding interface - provided by Worker context
interface Env {
  AUTH_DB: AuthDatabase;
}

function getAuthDb(): AuthDatabase | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
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
  /**
   * Workspace foreign key (multi-tenant link). Stamped on create from the
   * active workspace cookie. Legacy portals without a workspaceId remain
   * accessible to global admins (org-wide), so this is a non-breaking
   * additive change. Industry pattern: organization_id / workspace_id as
   * an indexed FK on every tenant-scoped resource (clockwise / Northflank /
   * flightcontrol 2026 multi-tenant guides).
   */
  workspaceId?: string;
  /**
   * Token expiry (ISO 8601). When set and in the past, `findPortalByToken`
   * refuses to resolve the portal. Magic-link best practice — tokens are the
   * sole client credential, so long-lived ones are dangerous. Existing
   * portals without an expiry stay valid forever (back-compat); newly
   * created portals default to 90 days.
   */
  expiresAt?: string;
}

/** Default token lifetime for newly minted portals (90 days). Aligns with
 *  the magic-link / long-lived-link guidance: short enough to bound exposure
 *  if a client forwards the URL, long enough that an active engagement
 *  doesn't re-issue weekly. Adjust per deployment if you want stricter. */
export const DEFAULT_PORTAL_TOKEN_TTL_DAYS = 90;

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

async function readFromD1(): Promise<ClientPortal[]> {
  const db = getAuthDb();
  if (!db) return [];
  try {
    const row = await db
      .prepare("SELECT value FROM config WHERE key = ?")
      .bind(D1_KEY)
      .first<{ value: string }>();
    if (row?.value) {
      const parsed: unknown = JSON.parse(row.value);
      if (Array.isArray(parsed)) {
        return parsed.map((p) => normalizePortal(p as ClientPortal));
      }
    }
  } catch (err) {
    console.warn(
      "[client-portals] D1 read failed:",
      err instanceof Error ? err.message : err
    );
  }
  return [];
}

async function writeToD1(portals: ClientPortal[]): Promise<void> {
  const db = getAuthDb();
  if (!db) throw new Error("D1 not available");
  await db
    .prepare(
      "INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    )
    .bind(D1_KEY, JSON.stringify(portals), Math.floor(Date.now() / 1000))
    .run();
}

async function readFromSSM(): Promise<ClientPortal[]> {
  try {
    const res = await getSsmClient().send(new GetParameterCommand({ Name: SSM_KEY }));
    const parsed: unknown = JSON.parse(res.Parameter?.Value ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => normalizePortal(p as ClientPortal));
  } catch {
    return [];
  }
}

async function writeToSSM(portals: ClientPortal[]): Promise<void> {
  await getSsmClient().send(
    new PutParameterCommand({
      Name: SSM_KEY,
      Value: JSON.stringify(portals),
      Type: "String",
      Overwrite: true,
      // Standard String parameters cap at 4KB; as portals accumulate (steps,
      // comments, deliverables) the JSON crosses that and PutParameter throws,
      // surfacing as a 500 on POST/PATCH/DELETE. Intelligent-Tiering stays
      // Standard (free) until the value exceeds 4KB, then auto-upgrades to the
      // 8KB Advanced tier — no crash, no cost for the common small case.
      Tier: "Intelligent-Tiering",
    })
  );
}

export async function readPortals(): Promise<ClientPortal[]> {
  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    const d1Result = await readFromD1();
    if (d1Result.length > 0) return d1Result;
  }
  return readFromSSM();
}

export async function writePortals(portals: ClientPortal[]): Promise<void> {
  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      await writeToD1(portals);
      return;
    } catch (err) {
      console.warn(
        "[client-portals] D1 write failed, falling back to SSM:",
        err instanceof Error ? err.message : err
      );
      // Fall through to SSM
    }
  }
  await writeToSSM(portals);
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
  const portal = portals.find((p) => tokenMatches(token, p.token));
  if (!portal) return null;
  // Honour expiry — once a token's TTL has passed, treat the portal as if
  // it didn't exist. The admin can re-mint a token (or extend expiresAt)
  // via the existing admin route. Magic-link security best practice: never
  // serve a portal with an expired token, even if the row still exists.
  if (portal.expiresAt) {
    const expiresMs = Date.parse(portal.expiresAt);
    if (Number.isFinite(expiresMs) && Date.now() > expiresMs) return null;
  }
  return portal;
}

/** Filter portals to only those belonging to a workspace. Org-wide portals
 *  (no workspaceId) are always included so the global admin keeps full
 *  visibility regardless of the active workspace context. */
export function filterPortalsByWorkspace(
  portals: ClientPortal[],
  workspaceId: string | null | undefined
): ClientPortal[] {
  if (!workspaceId) return portals;
  return portals.filter((p) => !p.workspaceId || p.workspaceId === workspaceId);
}

/** Compute a portal expiry from "now" plus a TTL in days. */
export function computePortalExpiry(ttlDays: number = DEFAULT_PORTAL_TOKEN_TTL_DAYS): string {
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
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