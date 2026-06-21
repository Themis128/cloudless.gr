/**
 * notion-gsc-reports tests removed 2026-06-21.
 *
 * src/lib/notion-gsc-reports.ts now reads from Athena (PR #1050) instead
 * of the deleted NOTION_GSC_REPORTS_DB_ID database. The previous tests
 * asserted Notion fetch calls that no longer happen.
 */
import { describe, it } from "vitest";

describe.skip("notion-gsc-reports (decommissioned)", () => {
  it("placeholder", () => {});
});
