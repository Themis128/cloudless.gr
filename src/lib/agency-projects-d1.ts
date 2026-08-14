/**
 * Agency delivery projects + time entries on user-auth-db.
 * Distinct from AppFlowy CMS projects (/admin/projects).
 */

import { getAuthDbFromEnv } from "@/lib/auth-d1";

export type AgencyProjectStatus = "active" | "on_hold" | "done" | "cancelled";

export interface AgencyProject {
  id: string;
  name: string;
  clientEmail: string | null;
  espoAccountId: string | null;
  status: AgencyProjectStatus;
  hourlyRateCents: number | null;
  currency: string;
  stripeCustomerId: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
  totalMinutes: number;
  unbilledMinutes: number;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  userId: string | null;
  workDate: string;
  minutes: number;
  billable: boolean;
  description: string | null;
  stripeInvoiceId: string | null;
  createdAt: number;
}

const STATUSES = new Set<AgencyProjectStatus>(["active", "on_hold", "done", "cancelled"]);

interface ProjectRow {
  id: string;
  name: string;
  client_email: string | null;
  espo_account_id: string | null;
  status: string;
  hourly_rate_cents: number | null;
  currency: string;
  stripe_customer_id: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
  total_minutes: number | null;
  unbilled_minutes: number | null;
}

interface EntryRow {
  id: string;
  project_id: string;
  user_id: string | null;
  work_date: string;
  minutes: number;
  billable: number;
  description: string | null;
  stripe_invoice_id: string | null;
  created_at: number;
}

function mapProject(row: ProjectRow): AgencyProject {
  const status = STATUSES.has(row.status as AgencyProjectStatus)
    ? (row.status as AgencyProjectStatus)
    : "active";
  return {
    id: row.id,
    name: row.name,
    clientEmail: row.client_email,
    espoAccountId: row.espo_account_id,
    status,
    hourlyRateCents: row.hourly_rate_cents,
    currency: row.currency || "EUR",
    stripeCustomerId: row.stripe_customer_id,
    notes: row.notes,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    totalMinutes: Number(row.total_minutes ?? 0),
    unbilledMinutes: Number(row.unbilled_minutes ?? 0),
  };
}

function mapEntry(row: EntryRow): TimeEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    workDate: row.work_date,
    minutes: Number(row.minutes),
    billable: Number(row.billable) === 1,
    description: row.description,
    stripeInvoiceId: row.stripe_invoice_id,
    createdAt: Number(row.created_at),
  };
}

export function isAgencyProjectStatus(v: string): v is AgencyProjectStatus {
  return STATUSES.has(v as AgencyProjectStatus);
}

export async function listAgencyProjects(limit = 50): Promise<{
  bound: boolean;
  projects: AgencyProject[];
}> {
  const db = getAuthDbFromEnv();
  if (!db) return { bound: false, projects: [] };

  const capped = Math.min(Math.max(limit, 1), 100);
  try {
    const result = await db
      .prepare(
        `SELECT p.*,
           COALESCE((SELECT SUM(minutes) FROM time_entry t WHERE t.project_id = p.id), 0) AS total_minutes,
           COALESCE((
             SELECT SUM(minutes) FROM time_entry t
             WHERE t.project_id = p.id AND t.billable = 1 AND t.stripe_invoice_id IS NULL
           ), 0) AS unbilled_minutes
         FROM agency_project p
         ORDER BY p.updated_at DESC
         LIMIT ?`
      )
      .bind(capped)
      .all<ProjectRow>();
    return { bound: true, projects: (result.results ?? []).map(mapProject) };
  } catch (err) {
    console.warn("[agency-projects-d1] list failed:", err instanceof Error ? err.message : err);
    return { bound: true, projects: [] };
  }
}

export async function createAgencyProject(input: {
  name: string;
  clientEmail?: string | null;
  hourlyRateCents?: number | null;
  currency?: string;
  notes?: string | null;
  status?: AgencyProjectStatus;
}): Promise<AgencyProject | null> {
  const db = getAuthDbFromEnv();
  if (!db) return null;

  const name = input.name.trim().slice(0, 200);
  if (!name) return null;
  const id = `ap_${crypto.randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const status = input.status && isAgencyProjectStatus(input.status) ? input.status : "active";
  const clientEmail = input.clientEmail?.trim().toLowerCase().slice(0, 320) || null;
  const currency = (input.currency ?? "EUR").trim().toUpperCase().slice(0, 3) || "EUR";
  const rate =
    typeof input.hourlyRateCents === "number" && input.hourlyRateCents >= 0
      ? Math.round(input.hourlyRateCents)
      : null;
  const notes = input.notes?.trim().slice(0, 2000) || null;

  try {
    await db
      .prepare(
        `INSERT INTO agency_project
          (id, name, client_email, status, hourly_rate_cents, currency, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, name, clientEmail, status, rate, currency, notes, now, now)
      .run();
    return {
      id,
      name,
      clientEmail,
      espoAccountId: null,
      status,
      hourlyRateCents: rate,
      currency,
      stripeCustomerId: null,
      notes,
      createdAt: now,
      updatedAt: now,
      totalMinutes: 0,
      unbilledMinutes: 0,
    };
  } catch (err) {
    console.warn("[agency-projects-d1] create failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function updateAgencyProjectStatus(
  id: string,
  status: AgencyProjectStatus
): Promise<boolean> {
  const db = getAuthDbFromEnv();
  if (!db || !id.startsWith("ap_") || !isAgencyProjectStatus(status)) return false;
  const now = Math.floor(Date.now() / 1000);
  try {
    const res = await db
      .prepare(`UPDATE agency_project SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(status, now, id)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  } catch (err) {
    console.warn("[agency-projects-d1] update failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function listTimeEntries(
  projectId: string,
  limit = 100
): Promise<{ bound: boolean; entries: TimeEntry[] }> {
  const db = getAuthDbFromEnv();
  if (!db) return { bound: false, entries: [] };
  if (!projectId.startsWith("ap_")) return { bound: true, entries: [] };

  const capped = Math.min(Math.max(limit, 1), 200);
  try {
    const result = await db
      .prepare(
        `SELECT * FROM time_entry
         WHERE project_id = ?
         ORDER BY work_date DESC, created_at DESC
         LIMIT ?`
      )
      .bind(projectId, capped)
      .all<EntryRow>();
    return { bound: true, entries: (result.results ?? []).map(mapEntry) };
  } catch (err) {
    console.warn("[agency-projects-d1] list time failed:", err instanceof Error ? err.message : err);
    return { bound: true, entries: [] };
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createTimeEntry(input: {
  projectId: string;
  workDate: string;
  minutes: number;
  description?: string | null;
  billable?: boolean;
  userId?: string | null;
}): Promise<TimeEntry | null> {
  const db = getAuthDbFromEnv();
  if (!db) return null;
  if (!input.projectId.startsWith("ap_")) return null;
  if (!DATE_RE.test(input.workDate)) return null;
  const minutes = Math.round(input.minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) return null;

  const id = `te_${crypto.randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const billable = input.billable === false ? 0 : 1;
  const description = input.description?.trim().slice(0, 500) || null;
  const userId = input.userId?.trim().slice(0, 128) || null;

  try {
    const exists = await db
      .prepare(`SELECT id FROM agency_project WHERE id = ?`)
      .bind(input.projectId)
      .first<{ id: string }>();
    if (!exists?.id) return null;

    await db
      .prepare(
        `INSERT INTO time_entry
          (id, project_id, user_id, work_date, minutes, billable, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, input.projectId, userId, input.workDate, minutes, billable, description, now)
      .run();

    await db
      .prepare(`UPDATE agency_project SET updated_at = ? WHERE id = ?`)
      .bind(now, input.projectId)
      .run();

    return {
      id,
      projectId: input.projectId,
      userId,
      workDate: input.workDate,
      minutes,
      billable: billable === 1,
      description,
      stripeInvoiceId: null,
      createdAt: now,
    };
  } catch (err) {
    console.warn("[agency-projects-d1] create time failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
