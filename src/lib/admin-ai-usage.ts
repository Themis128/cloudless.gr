/**
 * In-process Admin AI usage ring buffer for the Marketing Hub status card.
 * Resets on pod restart — good enough for free-tier ops visibility.
 */

export type AdminAiCallRecord = {
  at: string;
  ok: boolean;
  model: string;
  viaGateway: boolean;
  latencyMs: number;
  error?: string;
};

const MAX = 50;
const calls: AdminAiCallRecord[] = [];

export function recordAdminAiCall(entry: Omit<AdminAiCallRecord, "at"> & { at?: string }): void {
  calls.unshift({
    at: entry.at ?? new Date().toISOString(),
    ok: entry.ok,
    model: entry.model,
    viaGateway: entry.viaGateway,
    latencyMs: entry.latencyMs,
    error: entry.error,
  });
  if (calls.length > MAX) calls.length = MAX;
}

export function getAdminAiUsageSnapshot(): {
  total: number;
  ok: number;
  errors: number;
  viaGateway: number;
  recent: AdminAiCallRecord[];
  workersAiConfigured: boolean;
  aiGatewayConfigured: boolean;
  gatewayId: string | null;
  geminiConfigured: boolean;
} {
  const recent = calls.slice(0, 20);
  return {
    total: calls.length,
    ok: calls.filter((c) => c.ok).length,
    errors: calls.filter((c) => !c.ok).length,
    viaGateway: calls.filter((c) => c.viaGateway).length,
    recent,
    workersAiConfigured: Boolean(
      process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN
    ),
    aiGatewayConfigured: Boolean(process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim()),
    gatewayId: process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim() || null,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  };
}
