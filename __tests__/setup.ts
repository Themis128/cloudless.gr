/**
 * Global Vitest setup — runs once per worker thread before any test file.
 *
 * Sets all integration env vars to safe test defaults so tests never need
 * to mock @/lib/integrations or @/lib/ssm-config.  Individual tests can
 * override specific vars with vi.stubEnv() and call resetIntegrationCache()
 * / resetSsmCache() to pick up the change.
 */

import { beforeEach, afterEach, vi } from "vitest";
import { resetIntegrationCache, resetSlackConfigCache } from "@/lib/integrations";
import { resetSsmCache } from "@/lib/ssm-config";

// ── Notion ────────────────────────────────────────────────────────────────────
process.env.NOTION_API_KEY = "secret_test_key_12345";
process.env.NOTION_BLOG_DB_ID = "blog-db-123";
process.env.NOTION_SUBMISSIONS_DB_ID = "submissions-db-123";
process.env.NOTION_DOCS_DB_ID = "docs-db-123";
process.env.NOTION_PROJECTS_DB_ID = "projects-db-123";
process.env.NOTION_TASKS_DB_ID = "tasks-db-123";
process.env.NOTION_ANALYTICS_DB_ID = "analytics-db-123";
process.env.NOTION_WEBHOOK_SECRET = "whsec_notion_test";

// ── HubSpot ───────────────────────────────────────────────────────────────────
process.env.HUBSPOT_API_KEY = "test-hs-token";

// ── Slack ─────────────────────────────────────────────────────────────────────
process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
process.env.SLACK_SIGNING_SECRET = "test-signing-secret-32chars-padded";
// SLACK_WEBHOOK_URL intentionally NOT set globally — tests that need it use
// vi.stubEnv("SLACK_WEBHOOK_URL", "...") in their own beforeEach, so that
// the "when neither configured" SlackClient tests see no webhook by default.

// ── Stripe ────────────────────────────────────────────────────────────────────
process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_123";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";

// ── AWS SES ───────────────────────────────────────────────────────────────────
process.env.SES_FROM_EMAIL = "test@cloudless.gr";
process.env.SES_TO_EMAIL = "inbox@cloudless.gr";
process.env.AWS_SES_REGION = "us-east-1";

// ── Google / GSC ─────────────────────────────────────────────────────────────
process.env.GOOGLE_CLIENT_EMAIL = "svc@project.iam.gserviceaccount.com";
process.env.GOOGLE_PRIVATE_KEY =
  "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----";
process.env.GOOGLE_CALENDAR_ID = "calendar@cloudless.gr";
process.env.GSC_SITE_URL = "sc-domain:cloudless.gr";

// ── Cognito ───────────────────────────────────────────────────────────────────
process.env.COGNITO_USER_POOL_ID = "us-east-1_TestPool";
process.env.COGNITO_CLIENT_ID = "test-client-id";

// ── Cache resets ──────────────────────────────────────────────────────────────
// Reset all in-memory caches before and after each test so vi.stubEnv() changes
// are always picked up and never leak between tests.
beforeEach(() => {
  // Prevent the CI job-level SLACK_WEBHOOK_URL secret from leaking into tests.
  // Tests that need it set use vi.stubEnv("SLACK_WEBHOOK_URL", "...") themselves.
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete process.env.SLACK_WEBHOOK_URL;
  resetIntegrationCache();
  resetSlackConfigCache();
  resetSsmCache();
});

afterEach(() => {
  // Restore any env vars stubbed via vi.stubEnv() so per-test env stubs never
  // bleed into subsequent tests.
  // NOTE: vi.unstubAllGlobals() is intentionally omitted — some test files
  // (e.g. notion-client.test.ts) stub globals at module level and expect those
  // stubs to persist across all tests in the file.
  vi.unstubAllEnvs();
  resetIntegrationCache();
  resetSlackConfigCache();
  resetSsmCache();
});
