/**
 * Plan keys + labels — single source of truth shared across client and
 * server code paths. Kept free of any runtime dependencies (no AWS SDK,
 * no Node-only imports) so it can be imported into both server routes
 * (`src/lib/pending-clients.ts`, `/api/portal/enroll`) and the client
 * waiting-room UI (`src/app/portal/waiting/WaitingRoomClient.tsx`)
 * without dragging server-only deps into the browser bundle.
 */

export const PLAN_LABELS: Record<string, string> = {
  cloud: "Cloud Architecture & Migration",
  serverless: "Serverless Development",
  analytics: "Data Analytics & Dashboards",
  marketing: "AI & Digital Marketing",
  web: "Web Design & Development",
  hosting: "Managed Hosting & Maintenance",
  bundle: "Full-Stack Growth Engine (Bundle)",
};

export type PlanKey = keyof typeof PLAN_LABELS;

export const PLAN_KEYS: ReadonlySet<string> = new Set(Object.keys(PLAN_LABELS));

/** Returns true if `value` is a known plan key. */
export function isValidPlan(value: unknown): value is PlanKey {
  return typeof value === "string" && PLAN_KEYS.has(value);
}
