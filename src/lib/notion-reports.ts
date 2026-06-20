/**
 * Notion Reports — DECOMMISSIONED 2026-06-20.
 *
 * Replaced by Athena views over the data lake — report generation now
 * persists to S3 Parquet + DynamoDB instead of a Notion DB. The Notion
 * env var `NOTION_REPORTS_DB_ID` has been removed from
 * `lib/integrations.ts` + `lib/ssm-config.ts`.
 *
 * This module is kept as a no-op shim so callers in `lib/reports.ts`
 * (the report-generation pipeline) don't crash. Each function preserves
 * its original signature and returns `null` / `false`. Callers already
 * tolerate a `null` from notionListReports because the Notion path was
 * always optional.
 *
 * Migration follow-up tracked in memory `project_notion_decom_plan`.
 * Remove this file once `lib/reports.ts` is fully migrated to Athena.
 */

import type { Report } from "@/lib/reports";

export async function notionListReports(): Promise<Report[] | null> {
  return null;
}

export async function notionGetReport(_id: string): Promise<Report | null> {
  return null;
}

export async function notionCreateReport(_report: Report): Promise<string | null> {
  return null;
}

export async function notionUpdateReport(
  _id: string,
  _updates: Partial<Report>
): Promise<boolean> {
  return false;
}

export async function notionDeleteReport(_id: string): Promise<boolean> {
  return false;
}
