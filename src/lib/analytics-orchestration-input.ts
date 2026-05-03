import type { AnalyticsConnector } from "@/lib/analytics-agent-orchestrator";

export const ALLOWED_ANALYTICS_CONNECTORS: AnalyticsConnector[] = [
  "quicksight",
  "powerbi",
  "tableau",
  "lookerstudio",
  "metabase",
];

export const DEFAULT_ANALYTICS_CONNECTORS: AnalyticsConnector[] = [
  "quicksight",
  "powerbi",
];

export interface AnalyticsOrchestrationInput {
  windowDays: number;
  connectors: AnalyticsConnector[];
  goals: string[];
  reportTitle: string;
}

function normalizeConnectors(value: unknown): AnalyticsConnector[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [...DEFAULT_ANALYTICS_CONNECTORS];
  }

  const deduped = new Set<AnalyticsConnector>();
  for (const entry of value) {
    const normalized = String(entry).trim().toLowerCase() as AnalyticsConnector;
    if (ALLOWED_ANALYTICS_CONNECTORS.includes(normalized)) {
      deduped.add(normalized);
    }
  }

  return Array.from(deduped);
}

export function parseAnalyticsOrchestrationRequestBody(
  body: unknown,
): AnalyticsOrchestrationInput {
  const payload =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const record = payload as Record<string, unknown>;

  let windowDays = 30;
  if (record.windowDays !== undefined) {
    const parsed = Number(record.windowDays);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) {
      throw new Error("windowDays must be between 1 and 365");
    }
    windowDays = Math.trunc(parsed);
  }

  const connectors = normalizeConnectors(record.connectors);
  if (connectors.length === 0) {
    throw new Error("At least one valid connector is required");
  }

  const goals = Array.isArray(record.goals)
    ? record.goals.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const reportTitle =
    record.reportTitle === undefined
      ? "Stripe Analytics Report"
      : String(record.reportTitle).trim();

  if (!reportTitle) {
    throw new Error("reportTitle cannot be empty");
  }

  return {
    windowDays,
    connectors,
    goals,
    reportTitle,
  };
}
