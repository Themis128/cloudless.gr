/**
 * Pending clients — signed up + selected a plan, awaiting admin review.
 * Stored in D1 app_config key PENDING_CLIENTS_JSON (Cloudflare-first).
 */

import { readJsonConfig, writeJsonConfig } from "@/lib/app-config-json";

const CONFIG_KEY = "PENDING_CLIENTS_JSON";

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
import { PLAN_LABELS } from "./plans";
export { PLAN_LABELS };

export async function readPendingClients(): Promise<PendingClient[]> {
  const parsed = await readJsonConfig<unknown>(CONFIG_KEY, []);
  return Array.isArray(parsed) ? (parsed as PendingClient[]) : [];
}

export async function writePendingClients(clients: PendingClient[]): Promise<void> {
  await writeJsonConfig(CONFIG_KEY, clients, "Pending client enrollments");
}

/**
 * Upsert a pending client by email. If they already exist, updates the
 * plan and resets to "waiting" status (only if they aren't already approved).
 */
export async function upsertPendingClient(
  input: Pick<PendingClient, "email" | "plan"> & Partial<PendingClient>
): Promise<PendingClient> {
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
  // If already approved, return as-is — don't reset their status
  if (existing.status === "approved") {
    return existing;
  }

  const updated: PendingClient = {
    ...existing,
    plan: input.plan,
    planLabel: input.planLabel ?? PLAN_LABELS[input.plan] ?? input.plan,
    name: input.name ?? existing.name,
    notes: input.notes ?? existing.notes,
    submittedAt: existing.submittedAt, // keep original submission date
  };
  clients[idx] = updated;
  await writePendingClients(clients);
  return updated;
}

export async function findPendingByEmail(email: string): Promise<PendingClient | null> {
  const clients = await readPendingClients();
  return clients.find((c) => c.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function approvePendingClient(
  email: string,
  portalToken: string
): Promise<PendingClient | null> {
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
