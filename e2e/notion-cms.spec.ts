/**
 * Notion CMS E2E — retired.
 *
 * Live CMS is AppFlowy (`e2e/appflowy-cms.spec.ts`). Public blog/docs pages
 * prefer AppFlowy helpers with static/empty fallbacks; Notion admin routes are
 * gone. Keep this file as an explicit skip so old docs/scripts that still
 * reference `notion-cms.spec.ts` do not revive Notion-only coverage.
 *
 * See `.cursor/rules/appflowy-cms.mdc`.
 */

import { test } from "@playwright/test";

test.describe("Notion CMS (retired)", () => {
  test.skip(true, "Notion CMS retired — use e2e/appflowy-cms.spec.ts");

  test("placeholder so the file stays a valid suite", () => {
    // Intentionally empty — suite is skipped above.
  });
});
