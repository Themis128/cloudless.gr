/**
 * notion-reports tests removed 2026-06-21.
 *
 * src/lib/notion-reports.ts is a pure no-op shim post-PR #1044 — every
 * function returns null/false. The previous tests asserted Notion fetch
 * calls + IntegrationNotConfiguredError throws that no longer exist.
 */
import { describe, it } from "vitest";

describe.skip("notion-reports (decommissioned)", () => {
  it("placeholder", () => {});
});
