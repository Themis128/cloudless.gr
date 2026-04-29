/**
 * Pending clients — clients who have signed up + selected a plan but
 * are waiting for an admin to review and provision their portal.
 *
 * Stored in SSM under /cloudless/PENDING_CLIENTS_JSON as a JSON array.
 * The admin approves a pending client which creates a ClientPortal
 * entry and links the portal token back here.
 */

import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
} from "@aws-sdk/client-ssm";

const SSM_KEY = "/cloudless/PENDING_CLIENTS_JSON";
const REGION = process.env.AWS_REGION || "eu-central-1";

const ssmClient = new SSMClient({ region: REGION });

export type PendingStatus = "waiting" | "approved" | "declined";

export interface PendingClient {
  /** Cognito email (unique key) */
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

export const PLAN_LABELS: Record<string, string> = {
  cloud: "Cloud Architecture & Migration",
  serverless: "Serverless Development",
  analytics: "Data Analytics & Dashboards",
  marketing: "AI & Digital Marketing",
  web: "Web Design & Development",
  hosting: "Managed Hosting & Maintenance",
  bundle: "Full-Stack Growth Engine (Bundle)",
};

export async function readPendingClients(): Promise<PendingClient[]> {
  try {
    const res = await ssmClient.send(
      new GetParameterCommand({ Name: SSM_KEY }),
    );
    return JSON.parse(res.Parameter?.Value ?? "[]");
  } catch {
    return [];
  }
}

export async function writePendingClients(
  clients: PendingClient[],
): Promise<void> {
  await ssmClient.send(
    new PutParameterCommand({
      Name: SSM_KEY,
      Value: JSON.stringify(clients),
      Type: "String",
      Overwrite: true,
    }),
  );
}

/**
 * Upsert a pending client by email. If they already exist, updates the
 * plan and resets to "waiting" status (only if they aren't already approved).
 */
export async function upsertPendingClient(
  input: Pick<PendingClient, "email" | "plan"> & Partial<PendingClient>,
): Promise<PendingClient> {
  const clients = await readPendingClients();
  const idx = clients.findIndex(
    (c) => c.email.toLowerCase() === input.email.toLowerCase(),
  );

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

export async function findPendingByEmail(
  email: string,
): Promise<PendingClient | null> {
  const clients = await readPendingClients();
  return (
    clients.find((c) => c.email.toLowerCase() === email.toLowerCase()) ?? null
  );
}

export async function approvePendingClient(
  email: string,
  portalToken: string,
): Promise<PendingClient | null> {
  const clients = await readPendingClients();
  const idx = clients.findIndex(
    (c) => c.email.toLowerCase() === email.toLowerCase(),
  );
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
