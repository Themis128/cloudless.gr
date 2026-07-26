/** * Pending clients utilities for managing pending client access. * Compatibility wrapper for AWS SDK usage in Cloudflare Workers environment. */
export type PendingClient = {
  email: string;
  name?: string;
  plan: string;
  planLabel?: string;
  submittedAt: string;
  notes?: string;
  status: "waiting" | "approved" | "declined";
  portalToken?: string;
  approvedAt?: string;
};

export const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
  enterprise: "Enterprise",
};

export function readPendingClients(): PendingClient[] {
  return [];
}

export function writePendingClients(clients: PendingClient[]): void {
  // NOOP for type compatibility
}

export function approvePendingClient(email: string): void {
  // NOOP for type compatibility
}

export function upsertPendingClient(client: PendingClient): void {
  // NOOP for type compatibility
}

export function findPendingByEmail(email: string): PendingClient | undefined {
  return undefined;
}
