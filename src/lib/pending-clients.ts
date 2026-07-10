/**
 * Pending clients — clients who have signed up + selected a plan but
 * are waiting for an admin to review and provision their portal.
 *
 * D1 primary (Cloudflare Workers) + SSM fallback (AWS Lambda).
 * D1 table: pending_client
 * SSM legacy: /cloudless/PENDING_CLIENTS_JSON as a JSON array.
 */

import { SSMClient, GetParameterCommand, PutParameterCommand } from "@aws-sdk/client-ssm";
import type { AuthDatabase } from "@/lib/auth-d1";

const SSM_KEY = "/cloudless/PENDING_CLIENTS_JSON";
const REGION = process.env.AWS_REGION || "eu-central-1";

const ssmClient = new SSMClient({ region: REGION });

// D1 binding interface - provided by Worker context
interface Env {
  AUTH_DB: AuthDatabase;
}

function getAuthDb(): AuthDatabase | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

export type PendingStatus = "waiting" | "approved" | "declined";

export interface PendingClient {
  /** Email (unique key) */
  email: string;
  name?: string;
  /** Plan selected on the services page (e.g. "bundle", "cloud", "serverless") */
  plan: string;
  /** Optional human-readable plan label, e.g. "Full-Stack Growth Engine" */
  planLabel?: string;
  submittedAt: string;
  status: PendingStatus;
  /** Set when admin approves and creates a portal */
  portalToken?: string;
  approvedAt?: string;
  /** Free-form notes set by the client (e.g. project context) */
  notes?: string;
}

// PLAN_LABELS lives in the shared, dependency-free `./plans` module so
// the client-side waiting room (which must not pull AWS SDK into the
// browser bundle) and the server enroll route both consume the same map.
// We import + re-export so callers of this file get the same name they
// always did AND we can use it ourselves below.
import { PLAN_LABELS } from "./plans";
export { PLAN_LABELS };

function rowToPendingClient(row: Record<string, unknown>): PendingClient {
  return {
    email: String(row.email),
    name: row.name ? String(row.name) : undefined,
    plan: String(row.plan),
    planLabel: row.plan_label ? String(row.plan_label) : undefined,
    submittedAt: String(row.submitted_at),
    status: String(row.status) as PendingStatus,
    portalToken: row.portal_token ? String(row.portal_token) : undefined,
    approvedAt: row.approved_at ? String(row.approved_at) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function pendingClientToRow(client: PendingClient): Record<string, unknown> {
  return {
    email: client.email,
    name: client.name || null,
    plan: client.plan,
    plan_label: client.planLabel || null,
    submitted_at: client.submittedAt,
    status: client.status,
    portal_token: client.portalToken || null,
    approved_at: client.approvedAt || null,
    notes: client.notes || null,
  };
}

async function readFromD1(): Promise<PendingClient[]> {
  const db = getAuthDb();
  if (!db) return [];
  try {
    const result = await db
      .prepare("SELECT * FROM pending_client ORDER BY submitted_at DESC")
      .all<Record<string, unknown>>();
    return (result.results ?? []).map(rowToPendingClient);
  } catch {
    return [];
  }
}

async function writeToD1(clients: PendingClient[]): Promise<void> {
  const db = getAuthDb();
  if (!db) throw new Error("D1 not available");

  // D1 doesn't support multi-row insert with conflict, so use a transaction-like approach
  // Delete all and re-insert (acceptable for small datasets < 1000 rows)
  await db.prepare("DELETE FROM pending_client").run();

  for (const client of clients) {
    const row = pendingClientToRow(client);
    await db
      .prepare(
        "INSERT INTO pending_client (email, name, plan, plan_label, submitted_at, status, portal_token, approved_at, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        row.email,
        row.name,
        row.plan,
        row.plan_label,
        row.submitted_at,
        row.status,
        row.portal_token,
        row.approved_at,
        row.notes,
        Math.floor(Date.now() / 1000)
      )
      .run();
  }
}

async function readFromSSM(): Promise<PendingClient[]> {
  try {
    const res = await ssmClient.send(new GetParameterCommand({ Name: SSM_KEY }));
    return JSON.parse(res.Parameter?.Value ?? "[]");
  } catch {
    return [];
  }
}

async function writeToSSM(clients: PendingClient[]): Promise<void> {
  await ssmClient.send(
    new PutParameterCommand({
      Name: SSM_KEY,
      Value: JSON.stringify(clients),
      Type: "String",
      Overwrite: true,
    })
  );
}

export async function readPendingClients(): Promise<PendingClient[]> {
  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      return await readFromD1();
    } catch (err) {
      console.warn(
        "[pending-clients] D1 read failed, falling back to SSM:",
        err instanceof Error ? err.message : err
      );
      // Fall through to SSM
    }
  }
  return readFromSSM();
}

export async function writePendingClients(clients: PendingClient[]): Promise<void> {
  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      await writeToD1(clients);
      return;
    } catch (err) {
      console.warn(
        "[pending-clients] D1 write failed, falling back to SSM:",
        err instanceof Error ? err.message : err
      );
      // Fall through to SSM
    }
  }
  await writeToSSM(clients);
}

/**
 * Upsert a pending client by email. If they already exist, updates the
 * plan and resets to "waiting" status (only if they aren't already approved).
 */
export async function upsertPendingClient(
  input: Pick<PendingClient, "email" | "plan"> & Partial<PendingClient>
): Promise<PendingClient> {
  const db = getAuthDb();
  if (db) {
    try {
      // Check if exists
      const existing = await db
        .prepare("SELECT * FROM pending_client WHERE email = ?")
        .bind(input.email.toLowerCase())
        .first<Record<string, unknown>>();

      if (existing) {
        const client = rowToPendingClient(existing);
        if (client.status === "approved") {
          return client;
        }
        // Update
        const updated: PendingClient = {
          ...client,
          plan: input.plan,
          planLabel: input.planLabel ?? PLAN_LABELS[input.plan] ?? input.plan,
          name: input.name ?? client.name,
          notes: input.notes ?? client.notes,
          submittedAt: client.submittedAt,
        };
        await db
          .prepare(
            "UPDATE pending_client SET plan = ?, plan_label = ?, name = ?, notes = ?, updated_at = ? WHERE email = ?"
          )
          .bind(
            updated.plan,
            updated.planLabel || null,
            updated.name || null,
            updated.notes || null,
            Math.floor(Date.now() / 1000),
            updated.email.toLowerCase()
          )
          .run();
        return updated;
      }

      // Create new
      const created: PendingClient = {
        email: input.email.toLowerCase(),
        name: input.name,
        plan: input.plan,
        planLabel: input.planLabel ?? PLAN_LABELS[input.plan] ?? input.plan,
        submittedAt: new Date().toISOString(),
        status: "waiting",
        notes: input.notes,
      };
      const row = pendingClientToRow(created);
      await db
        .prepare(
          "INSERT INTO pending_client (email, name, plan, plan_label, submitted_at, status, portal_token, approved_at, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          row.email,
          row.name,
          row.plan,
          row.plan_label,
          row.submitted_at,
          row.status,
          row.portal_token,
          row.approved_at,
          row.notes,
          Math.floor(Date.now() / 1000)
        )
        .run();
      return created;
    } catch (err) {
      console.warn(
        "[pending-clients] D1 upsert failed, falling back to SSM:",
        err instanceof Error ? err.message : err
      );
      // Fall through to SSM path
    }
  }

  // SSM fallback path (original implementation)
  const clients = await readPendingClients();
  const idx = clients.findIndex((c) => c.email.toLowerCase() === input.email.toLowerCase());

  if (idx === -1) {
    const created: PendingClient = {
      email: input.email,
      name: input.name,
      plan: input.plan,
      planLabel: input.planLabel ?? PLAN_LABELS[input.plan] ?? input.plan,
      submittedAt: new Date().toISOString(),
      status: "waiting",
      notes: input.notes,
    };
    clients.push(created);
    await writePendingClients(clients);
    return created;
  }

  const existing = clients[idx];
  if (existing.status === "approved") {
    return existing;
  }

  const updated: PendingClient = {
    ...existing,
    plan: input.plan,
    planLabel: input.planLabel ?? PLAN_LABELS[input.plan] ?? input.plan,
    name: input.name ?? existing.name,
    notes: input.notes ?? existing.notes,
    submittedAt: existing.submittedAt,
  };
  clients[idx] = updated;
  await writePendingClients(clients);
  return updated;
}

export async function findPendingByEmail(email: string): Promise<PendingClient | null> {
  const db = getAuthDb();
  if (db) {
    try {
      const row = await db
        .prepare("SELECT * FROM pending_client WHERE email = ?")
        .bind(email.toLowerCase())
        .first<Record<string, unknown>>();
      if (row) return rowToPendingClient(row);
    } catch (err) {
      console.warn(
        "[pending-clients] D1 findByEmail failed, falling back to SSM:",
        err instanceof Error ? err.message : err
      );
      // Fall through
    }
  }
  const clients = await readPendingClients();
  return clients.find((c) => c.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function approvePendingClient(
  email: string,
  portalToken: string
): Promise<PendingClient | null> {
  const db = getAuthDb();
  if (db) {
    try {
      const row = await db
        .prepare("SELECT * FROM pending_client WHERE email = ?")
        .bind(email.toLowerCase())
        .first<Record<string, unknown>>();
      if (!row) return null;

      const approvedAt = new Date().toISOString();
      await db
        .prepare(
          "UPDATE pending_client SET status = ?, portal_token = ?, approved_at = ?, updated_at = ? WHERE email = ?"
        )
        .bind("approved", portalToken, approvedAt, Math.floor(Date.now() / 1000), email.toLowerCase())
        .run();

      return {
        ...rowToPendingClient(row),
        status: "approved",
        portalToken,
        approvedAt,
      };
    } catch (err) {
      console.warn(
        "[pending-clients] D1 approve failed, falling back to SSM:",
        err instanceof Error ? err.message : err
      );
      // Fall through
    }
  }

  const clients = await readPendingClients();
  const idx = clients.findIndex((c) => c.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return null;
  clients[idx] = {
    ...clients[idx],
    status: "approved",
    portalToken,
    approvedAt: new Date().toISOString(),
  };
  await writePendingClients(clients);
  return clients[idx];
}
