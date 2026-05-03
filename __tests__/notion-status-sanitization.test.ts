/**
 * Static regression check for the Notion status err.message leak fix
 * (commit a69f3446, gap #3 from the security audit).
 *
 * The behavioral path is hard to e2e (needs admin auth + a Notion DB
 * that fails predictably), so we lock the contract at the source-file
 * level: the route MUST NOT return raw `err.message`/`String(err)` to
 * the client, and MUST return the generic `"upstream-notion-error"`
 * code instead. A future refactor that re-introduces the leak fails
 * this test loudly.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE = resolve(__dirname, "../src/app/api/admin/notion/status/route.ts");

describe("notion status route — error sanitization", () => {
  const source = readFileSync(ROUTE, "utf-8");

  it("does not return err.message in any response object", () => {
    // Match the previous-leaky pattern: error: err instanceof Error ? err.message : ...
    expect(source).not.toMatch(/error:\s*err\s+instanceof\s+Error\s*\?\s*err\.message/);
    // And the bare String(err) fallback that was paired with it.
    expect(source).not.toMatch(/error:\s*[^,)]*String\(\s*err\s*\)/);
  });

  it("uses the generic public error code", () => {
    expect(source).toContain('"upstream-notion-error"');
  });

  it("still logs the raw error server-side (so debugging is preserved)", () => {
    // Sanity: we want the error LOGGED, just not RETURNED. Ensure a
    // console.error call survives in the catch block referencing err.
    expect(source).toMatch(/console\.error\([^)]*err/);
  });
});
