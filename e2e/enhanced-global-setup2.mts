/**
 * Enhanced Pre-flight health gate with auto-recovery capabilities.
 * 
 * Improvements over the original:
 * 1. Clean up existing processes on port 4000 to avoid conflicts.
 * 2. Quick health check to ensure the server started by webServer is healthy.
 * 3. Fail fast with clear error messages if the server is not healthy.
 */

import type { FullConfig } from "@playwright/test";

const BASE_URL = "http://localhost:4000";

/**
 * Kill any existing processes on port 4000 to ensure clean state
 */
function cleanupExistingServer(): void {
  try {
    // Try to find and kill processes on port 4000
    const output = execSync("lsof -ti:4000", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    const pids = output.trim().split("\n").filter(Boolean);
    
    if (pids.length > 0) {
      console.log(`[e2e:enhanced-setup] Found ${pids.length} existing process(es) on port 4000, cleaning up...`);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: "ignore" });
          console.log(`[e2e:enhanced-setup] Killed process ${pid}`);
        } catch (err) {
          // Process might have already exited
        }
      }
    }
  } catch (err) {
    // No processes found or lsof not available - this is fine
    console.log("[e2e:enhanced-setup] No existing processes found on port 4000");
  }
}

/**
 * Probe an endpoint with a short timeout and simple success check.
 */
async function probe(
  pathname: string,
  options: {
    accept: string;
    expectedStatus?: number;
    expectedJsonProps?: Record<string, any>;
    timeout?: number;
  }
): Promise<boolean> {
  const { accept, expectedStatus = 200, expectedJsonProps, timeout = 5000 } = options;
  const url = `${BASE_URL}${pathname}`;
  
  try {
    const res = await fetch(url, { 
      headers: { accept }
    });
    
    // Check status code
    if (res.status !== expectedStatus) {
      return false;
    }
    
    // If expecting JSON, validate it
    if (accept.includes("application/json")) {
      const json = await res.json();
      if (expectedJsonProps) {
        for (const [key, expectedValue] of Object.entries(expectedJsonProps)) {
          if (!(key in json)) {
            return false;
          }
          if (expectedValue !== undefined && json[key] !== expectedValue) {
            return false;
          }
        }
      }
    }
    
    return true;
  } catch (err) {
    // Any error (timeout, network, etc.) means failure
    return false;
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  console.log("[e2e:enhanced-setup] Starting enhanced server health validation...");
  
  // Step 1: Clean up any existing server processes to ensure clean state
  cleanupExistingServer();
  
  // Step 2: Perform quick health checks on the server that should be started by webServer
  console.log("[e2e:enhanced-setup] Checking API health...");
  const apiHealthy = await probe("/api/health", {
    accept: "application/json",
    expectedJsonProps: { status: ["ok", "degraded"] }, // Accept both ok and degraded
    timeout: 5000
  });
  
  if (!apiHealthy) {
    throw new Error(
      `[e2e:enhanced-setup] API health check failed: /api/health is not responding or returning unhealthy status.\n\n` +
      `Troubleshooting suggestions:\n` +
      `1. Check if the dev server was started by Playwright webServer.\n` +
      `2. Check server logs for errors.\n` +
      `3. Try manually: pnpm dev\n` +
      `4. Verify Next.js and dependencies are installed correctly`
    );
  }
  
  console.log("[e2e:enhanced-setup] API health check passed.");
  
  console.log("[e2e:enhanced-setup] Checking locale routing...");
  const localeHealthy = await probe("/en", {
    accept: "text/html",
    expectedStatus: 200,
    timeout: 5000
  });
  
  if (!localeHealthy) {
    throw new Error(
      `[e2e:enhanced-setup] Locale check failed: /en is not returning a successful response.\n\n` +
      `Troubleshooting suggestions:\n` +
      `1. Check if the dev server was started by Playwright webServer.\n` +
      `2. Check server logs for errors.\n` +
      `3. Try manually: pnpm dev\n` +
      `4. Verify Next.js and dependencies are installed correctly`
    );
  }
  
  console.log("[e2e:enhanced-setup] ����� ��� ��� � ��� � � ✓ Server is healthy - /api/health and /en both resolve.");
  console.log("[e2e:enhanced-setup] Enhanced setup completed successfully.");
}