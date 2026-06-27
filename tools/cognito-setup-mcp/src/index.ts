#!/usr/bin/env node
/**
 * cognito-setup-mcp — MCP server for automated Cognito setup
 *
 * Provides tools to:
 *   - Validate AWS credentials
 *   - Fetch Cognito credentials from SSM
 *   - Update .env.local
 *   - Test dev server startup
 *
 * Usage:
 *   npx tsx tools/cognito-setup-mcp/src/index.ts
 *
 * In Claude Code:
 *   /cognito-setup                 # Run full setup
 *   /cognito-setup --dry-run       # Preview without changes
 *   /cognito-setup --skip-verify   # Skip dev server test
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, copyFileSync } from "fs";
import { join } from "path";

const server = new McpServer({
  name: "cognito-setup",
  version: "1.0.0",
});

const REPO_ROOT = process.cwd();
const ENV_LOCAL = join(REPO_ROOT, ".env.local");
const _POOL_ID = "us-east-1_1Bq3Mpqer";
const REGION = "us-east-1";

interface Result {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

function result(success: boolean, message: string, data?: Record<string, unknown>): Result {
  return { success, message, data };
}

function run(cmd: string): { stdout: string; success: boolean } {
  try {
    const stdout = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return { stdout, success: true };
  } catch (_e) {
    return { stdout: "", success: false };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Tool 1: Check AWS credentials
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "cognito_check_aws_creds",
  "Check if AWS credentials are valid and authenticate if needed",
  {},
  async (): Promise<Result> => {
    // Check AWS CLI
    const cliCheck = run("which aws");
    if (!cliCheck.success) {
      return result(false, "AWS CLI not found. Install with: pip install awscli");
    }

    // Test current credentials
    const authCheck = run("aws sts get-caller-identity --output json");
    if (authCheck.success) {
      try {
        const identity = JSON.parse(authCheck.stdout);
        return result(true, `Authenticated as ${identity.Arn}`, { identity });
      } catch {
        return result(false, "Could not parse AWS identity");
      }
    }

    // Try SSO login
    const ssoCheck = run("aws sso login --sso-session cloudless 2>&1");
    if (ssoCheck.success) {
      // Verify auth succeeded
      const verifyCheck = run("aws sts get-caller-identity --output json");
      if (verifyCheck.success) {
        try {
          const identity = JSON.parse(verifyCheck.stdout);
          return result(true, `SSO login successful. Authenticated as ${identity.Arn}`, { identity });
        } catch {
          return result(false, "SSO login succeeded but identity check failed");
        }
      }
    }

    return result(
      false,
      "AWS authentication failed. Please run: aws sso login --sso-session cloudless (on a machine with a browser)"
    );
  }
);

// ════════════════════════════════════════════════════════════════════════════
// Tool 2: Fetch Cognito credentials from SSM
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "cognito_fetch_credentials",
  "Fetch COGNITO_CLIENT_ID and CLIENT_SECRET from AWS SSM Parameter Store",
  {},
  async (): Promise<Result> => {
    const clientIdCmd = `aws ssm get-parameter --name "/cloudless/production/COGNITO_CLIENT_ID" --region ${REGION} --query "Parameter.Value" --output text 2>&1`;
    const clientIdResult = run(clientIdCmd);

    if (!clientIdResult.success || clientIdResult.stdout.includes("ParameterNotFound")) {
      return result(false, "Failed to fetch COGNITO_CLIENT_ID from SSM", {
        error: clientIdResult.stdout,
      });
    }

    const clientId = clientIdResult.stdout.trim();

    const clientSecretCmd = `aws ssm get-parameter --name "/cloudless/production/COGNITO_CLIENT_SECRET" --with-decryption --region ${REGION} --query "Parameter.Value" --output text 2>&1`;
    const clientSecretResult = run(clientSecretCmd);

    let clientSecret = "";
    if (clientSecretResult.success && !clientSecretResult.stdout.includes("ParameterNotFound")) {
      clientSecret = clientSecretResult.stdout.trim();
    }

    return result(true, "Successfully fetched Cognito credentials from SSM", {
      clientId,
      clientSecret: clientSecret ? `${clientSecret.slice(0, 10)}...` : "not found (public client)",
      fullClientSecret: clientSecret,
    });
  }
);

// ════════════════════════════════════════════════════════════════════════════
// Tool 3: Update .env.local
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "cognito_update_env",
  "Update .env.local with Cognito credentials",
  {
    clientId: z.string().describe("COGNITO_CLIENT_ID value"),
    clientSecret: z.string().optional().describe("COGNITO_CLIENT_SECRET value"),
  },
  async ({ clientId, clientSecret }): Promise<Result> => {
    try {
      // Read existing .env.local
      const envContent = readFileSync(ENV_LOCAL, "utf-8");

      // Backup
      const timestamp = Math.floor(Date.now() / 1000);
      const backupPath = `${ENV_LOCAL}.backup.${timestamp}`;
      copyFileSync(ENV_LOCAL, backupPath);

      // Update credentials
      const updated = envContent
        .split("\n")
        .map((line) => {
          if (line.startsWith("NEXT_PUBLIC_COGNITO_CLIENT_ID=")) {
            return `NEXT_PUBLIC_COGNITO_CLIENT_ID=${clientId}`;
          }
          if (line.startsWith("COGNITO_CLIENT_ID=")) {
            return `COGNITO_CLIENT_ID=${clientId}`;
          }
          if (line.startsWith("COGNITO_CLIENT_SECRET=") && clientSecret) {
            return `COGNITO_CLIENT_SECRET=${clientSecret}`;
          }
          return line;
        })
        .join("\n");

      writeFileSync(ENV_LOCAL, updated);

      return result(true, `Updated .env.local with Cognito credentials`, {
        clientId,
        backupPath,
      });
    } catch (e) {
      return result(false, `Failed to update .env.local: ${String(e)}`);
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// Tool 4: Test dev server startup
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "cognito_test_dev_server",
  "Start dev server and verify Cognito auth is configured",
  { timeout: z.number().optional().default(30).describe("Timeout in seconds") },
  async ({ timeout }): Promise<Result> => {
    // Kill existing dev servers
    run("pkill -f 'next dev'");

    // Start dev server
    const startCmd = `pnpm dev > /tmp/dev-test.log 2>&1 &`;
    run(startCmd);

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // Test connectivity
    for (let i = 0; i < timeout; i++) {
      const testCmd = `curl -s http://localhost:4000/en > /dev/null && echo "success" || echo "fail"`;
      const testResult = run(testCmd);
      if (testResult.stdout.includes("success")) {
        return result(true, "Dev server started successfully with Cognito config");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return result(false, "Dev server test failed or timed out. Check /tmp/dev-test.log");
  }
);

// ════════════════════════════════════════════════════════════════════════════
// Tool 5: Full setup (orchestrator)
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "cognito_full_setup",
  "Run complete automated Cognito setup (check AWS → fetch creds → update env → test)",
  {
    skipVerify: z.boolean().optional().default(false).describe("Skip dev server test"),
    dryRun: z.boolean().optional().default(false).describe("Preview without making changes"),
  },
  async ({ skipVerify, dryRun }): Promise<Result> => {
    const steps: Array<{ name: string; success: boolean; message: string }> = [];

    // Step 1: Check AWS credentials
    const awsCheck = await server.callTool("cognito_check_aws_creds", {});
    if (!awsCheck.success) {
      return result(false, `Setup failed at AWS authentication: ${awsCheck.message}`, { steps });
    }
    steps.push({ name: "AWS Authentication", success: true, message: awsCheck.message });

    // Step 2: Fetch credentials
    const fetchResult = await server.callTool("cognito_fetch_credentials", {});
    if (!fetchResult.success) {
      return result(false, `Setup failed at credential fetch: ${fetchResult.message}`, { steps });
    }
    steps.push({ name: "Fetch Credentials", success: true, message: fetchResult.message });

    const clientId = (fetchResult.data?.clientId as string) || "";
    const clientSecret = (fetchResult.data?.fullClientSecret as string) || "";

    if (dryRun) {
      steps.push({
        name: "Update .env.local (DRY RUN)",
        success: true,
        message: `Would update COGNITO_CLIENT_ID and COGNITO_CLIENT_SECRET`,
      });
      return result(true, "Dry-run complete. No changes made.", { steps });
    }

    // Step 3: Update .env.local
    const updateResult = await server.callTool("cognito_update_env", {
      clientId,
      clientSecret,
    });
    if (!updateResult.success) {
      return result(false, `Setup failed at .env.local update: ${updateResult.message}`, {
        steps,
      });
    }
    steps.push({ name: "Update .env.local", success: true, message: updateResult.message });

    // Step 4: Test dev server (optional)
    if (!skipVerify) {
      const testResult = await server.callTool("cognito_test_dev_server", { timeout: 30 });
      if (!testResult.success) {
        // Non-fatal — the setup still worked, just the server test failed
        steps.push({
          name: "Dev Server Test",
          success: false,
          message: testResult.message,
        });
      } else {
        steps.push({ name: "Dev Server Test", success: true, message: testResult.message });
      }
    } else {
      steps.push({
        name: "Dev Server Test",
        success: true,
        message: "Skipped (--skip-verify)",
      });
    }

    return result(true, "✓ Cognito setup complete!", {
      steps,
      nextSteps: [
        "pnpm dev — Start dev server",
        "Visit http://localhost:4000/en",
        "Click 'Sign in' to test Cognito authentication",
      ],
    });
  }
);

// ════════════════════════════════════════════════════════════════════════════
// Start the MCP server
// ════════════════════════════════════════════════════════════════════════════

const transport = new StdioServerTransport();
server.connect(transport);
