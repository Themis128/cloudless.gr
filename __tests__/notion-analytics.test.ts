/**
 * notion-analytics tests removed 2026-06-21.
 *
 * src/lib/notion-analytics.ts was decommissioned in PR #1044 (Notion DB
 * decom) + rewired to Athena reads + no-op writes in PR #1050. Every
 * previous test asserted on Notion fetch/track behaviour that no longer
 * exists. The Athena read path is already exercised end-to-end via the
 * admin-kpi e2e sweep; per CLAUDE.md testing policy ("If the test
 * expectation is wrong... update the expectation -- but never shim
 * production behavior with mocks"), the only honest path was deletion.
 */
import { describe, it } from "vitest";

describe.skip("notion-analytics (decommissioned)", () => {
  it("placeholder", () => {});
});
