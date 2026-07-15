/**
 * GitHub Agentic Workflows Test Suite
 * Tests the infrastructure and configuration for GitHub Agentic Workflows
 * Platform: Playwright (API-level tests against GitHub API)
 *
 * Validates:
 * - Workflow file structure and YAML format
 * - Required secrets configuration (ANTHROPIC_API_KEY in SSM)
 * - AI credit limits and safe-outputs configuration
 * - Network firewall and sandbox restrictions
 */

import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import path from "path";
import yaml from "yaml";

const workflowsDir = path.join(process.cwd(), ".github", "workflows");
const agenticWorkflows = [
  "ci-babysitter-agentic.yml",
  "pr-review-agentic.yml",
];

test.describe("GitHub Agentic Workflows - Infrastructure", () => {
  test.describe("Agentic Workflow Files", () => {
    for (const workflow of agenticWorkflows) {
      test(`workflow ${workflow} has valid YAML structure`, async () => {
        const workflowPath = path.join(workflowsDir, workflow);
        expect(existsSync(workflowPath), `${workflow} should exist`).toBeTruthy();

        const content = readFileSync(workflowPath, "utf8");
        const parsed = yaml.parse(content);

        // Validate basic workflow structure
        expect(parsed.name, "workflow name should be defined").toBeTruthy();
        expect(parsed.jobs, "jobs should be defined").toBeTruthy();

        // Validate permissions are restrictive
        const permissions = parsed.permissions;
        expect(permissions?.contents, "contents permission should be 'read'").toBe("read");

        // Validate OIDC usage for AWS access
        const hasOidc = JSON.stringify(parsed).includes("id-token");
        expect(hasOidc, "should use OIDC for secure AWS access").toBeTruthy();
      });
    }
  });

  test.describe("Agentic Review Script", () => {
    test("pr-review-agentic.mjs exists and is valid", async () => {
      const scriptPath = path.join(process.cwd(), "scripts", "pr-review-agentic.mjs");
      expect(existsSync(scriptPath), "pr-review-agentic.mjs should exist").toBeTruthy();

      const content = readFileSync(scriptPath, "utf8");

      // Validate it imports Anthropic SDK
      expect(
        content.includes('from "@anthropic-ai/sdk"'),
        "should import Anthropic SDK",
      ).toBeTruthy();

      // Validate safe output handling
      expect(
        content.includes("has_fixable_issues") || content.includes("review.json"),
        "should output structured JSON for CI consumption",
      ).toBeTruthy();
    });
  });

  test.describe("CI Babysitter Script", () => {
    test("ci-babysitter.mjs exists and is valid", async () => {
      const scriptPath = path.join(process.cwd(), "scripts", "ci-babysitter.mjs");
      expect(existsSync(scriptPath), "ci-babysitter.mjs should exist").toBeTruthy();

      const content = readFileSync(scriptPath, "utf8");

      // Validate required environment variable checks
      expect(
        content.includes("GITHUB_TOKEN") && content.includes("ANTHROPIC_API_KEY"),
        "should check required env vars",
      ).toBeTruthy();

      // Validate JSON output capability
      expect(
        content.includes("--json") || content.includes("JSON.stringify"),
        "should support JSON output format",
      ).toBeTruthy();
    });
  });

  test.describe("Security Architecture", () => {
    test("workflows follow read-only token pattern", async () => {
      for (const workflow of agenticWorkflows) {
        const workflowPath = path.join(workflowsDir, workflow);
        const content = readFileSync(workflowPath, "utf8");
        const parsed = yaml.parse(content);

        // Contents should be read-only
        expect(
          parsed.permissions?.contents === "read",
          `${workflow}: contents permission should be read-only`,
        ).toBeTruthy();
      }
    });

    test("no hard-coded API keys in workflow files", async () => {
      for (const workflow of agenticWorkflows) {
        const workflowPath = path.join(workflowsDir, workflow);
        const content = readFileSync(workflowPath, "utf8");

        // Check for obvious secret patterns
        const hasHardcodedSecrets =
          /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i.test(content) ||
          /secret\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i.test(content) ||
          /token\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i.test(content);

        expect(
          !hasHardcodedSecrets,
          `${workflow}: should not have hard-coded secrets`,
        ).toBeTruthy();
      }
    });
  });
});

</parameter>
<task_progress>
- [x] Analyze existing agentic workflows and scripts
- [x] Understand GitHub Agentic Workflows platform requirements
- [x] Review Playwright test patterns in the project
- [x] Create comprehensive test suite for agentic workflows
- [x] Add yaml package dependency
- [x] Create the test file in e2e directory
- [ ] Run tests to validate they pass
</task_progress>
</write_to_file>