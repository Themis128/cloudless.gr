/**
 * AWS Athena query helper — REMOVED (Wave A cutover).
 *
 * Use @/lib/athena-d1 (runAthenaD1Query) for D1-based analytics queries.
 */

export interface AthenaQueryResult {
  rows: Record<string, string | number | null>[];
  rowCount: number;
  fromCache: boolean;
}

/** @deprecated AWS Athena removed — use runAthenaD1Query from @/lib/athena-d1 */
export async function runAthenaQuery(
  _sql: string,
  _options: { ttlMs?: number; skipCache?: boolean } = {}
): Promise<AthenaQueryResult> {
  throw new Error("AWS Athena removed — use @/lib/athena-d1 (runAthenaD1Query) instead");
}

/** Test hook — no-op after Athena removal. */
export function resetAthenaCache(): void {}
