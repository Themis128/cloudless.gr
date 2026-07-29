/**
 * Calendar booking readiness checks used by /api/calendar/* routes.
 * Re-exports agent-book configuration with an optional Request arg for callers
 * that pass the incoming request (ignored — config is env-based).
 */
import { isAgentBookConfigured as agentBookConfigured } from "@/lib/agent-book";

export async function isAgentBookConfigured(_request?: Request): Promise<boolean> {
  return agentBookConfigured();
}
