/**
 * Soft daily budget for non-auth D1 writes — keep Cloudflare Workers Free
 * (100k rows_written/day). Auth/session writes are NOT gated here.
 *
 * Counters are process-local (per Pi pod). Under-count is fine; goal is to
 * stop analytics/cache churn before CF hard-limits the account.
 *
 * Env:
 *   D1_DISCRETIONARY_WRITES=0     — disable all discretionary D1 writes
 *   D1_DISCRETIONARY_DAILY_BUDGET — default 50000 (leave ~50k headroom for auth)
 *   D1_FUNNEL_IMPRESSIONS=1      — allow rec_impression (off by default)
 *   D1_FUNNEL_SAMPLE             — 0..1, default 0.1 for non-impression funnel
 *   D1_ANALYTICS_SAMPLE          — 0..1, default 0.25 for analytics_events
 */

const FREE_TIER_DAILY_ROWS = 100_000;
/** Default discretionary budget — leave room for auth under the free cap. */
const DEFAULT_BUDGET = 50_000;

let dayKey = "";
let used = 0;

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function rollover(): void {
  const day = utcDayKey();
  if (day !== dayKey) {
    dayKey = day;
    used = 0;
  }
}

export function discretionaryBudgetLimit(): number {
  const raw = process.env.D1_DISCRETIONARY_DAILY_BUDGET?.trim();
  if (!raw) return DEFAULT_BUDGET;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_BUDGET;
  return Math.min(Math.floor(n), FREE_TIER_DAILY_ROWS);
}

/** Whether discretionary (analytics / cache / funnel) D1 writes are enabled. */
export function discretionaryWritesEnabled(): boolean {
  return process.env.D1_DISCRETIONARY_WRITES !== "0";
}

/**
 * Reserve `cost` rows against today's discretionary budget.
 * Returns false when disabled or budget exhausted (caller must skip the write).
 */
export function allowDiscretionaryD1Write(cost = 1): boolean {
  if (!discretionaryWritesEnabled()) return false;
  rollover();
  const need = Math.max(1, Math.floor(cost));
  if (used + need > discretionaryBudgetLimit()) return false;
  used += need;
  return true;
}

export function discretionaryWritesUsedToday(): number {
  rollover();
  return used;
}

/** Sample gate (0 = never, 1 = always). Uses CSPRNG — not for secrets, avoids S2245. */
export function passSample(rateEnv: string, defaultRate: number): boolean {
  const raw = process.env[rateEnv]?.trim();
  const rate = raw === undefined || raw === "" ? defaultRate : Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) return false;
  if (rate >= 1) return true;
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]! / 0x1_0000_0000 < rate;
}

export function funnelImpressionsEnabled(): boolean {
  return process.env.D1_FUNNEL_IMPRESSIONS === "1";
}

/** Test helper — reset in-memory counter. */
export function __resetDiscretionaryBudgetForTests(): void {
  dayKey = "";
  used = 0;
}
