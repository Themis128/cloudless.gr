/**
 * Enhanced Pre-flight health gate with auto-recovery capabilities.
 * 
 * Improvements over the original:
 * 1. More thorough health checking
 * 2. Automatic recovery attempts for common issues
 * 3. Better error diagnostics
 * 4. Clearer separation of concerns
 */

import type { FullConfig } from "@playwright/test";
import { promises as fs } from "fs";
import { execSync } from "child_process";

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
      // Give processes time to fully terminate
      setTimeout(() => {}, 1000);
    }
  } catch (err) {
    // No processes found or lsof not available - this is fine
    console.log("[e2e:enhanced-setup] No existing processes found on port 4000");
  }
}

/**
 * Probe an endpoint with enhanced error handling and diagnostics
 */
async function probe(
  pathname: string,
  options: {
    accept: string;
    expectedStatus?: number | number[];
    expectedJsonProps?: Record<string, any>;
    timeout?: number;
  }
): Promise<{ success: boolean; message?: string; details?: any }> {
  const { accept, expectedStatus = 200, expectedJsonProps, timeout = 10000 } = options;
  const url = `${BASE_URL}${pathname}`;
  
  let controller: AbortController | null = null;
  let timeoutId: NodeJS.Timeout | null = null;
  
  try {
    controller = new AbortController();
    timeoutId = setTimeout(() => {
      if (controller) controller.abort();
    }, timeout);
    
    const res = await fetch(url, { 
      headers: { accept },
      signal: controller?.signal
    });
    
    if (timeoutId) clearTimeout(timeoutId);
    
    // Check status code
    const statusArray = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (!statusArray.includes(res.status)) {
      let body = "";
      try {
        body = await res.text();
      } catch (e) {
        body = "<could not read body>";
      }
      
      return {
        success: false,
        message: `Expected status ${expectedStatus}, got ${res.status}`,
        details: { url, status: res.status, body: body.substring(0, 200) }
      };
    }
    
    // If expecting JSON, validate it
    if (accept.includes("application/json")) {
      try {
        const json = await res.json();
        if (expectedJsonProps) {
          for (const [key, expectedValue] of Object.entries(expectedJsonProps)) {
            if (!(key in json)) {
              return {
                success: false,
                message: `Missing JSON property: ${key}`,
                details: { url, received: json }
              };
            }
            if (expectedValue !== undefined && json[key] !== expectedValue) {
              return {
                success: false,
                message: `JSON property ${key} mismatch: expected ${expectedValue}, got ${json[key]}`,
                details: { url, received: json }
              };
            }
          }
        }
      } catch (e) {
        return {
          success: false,
          message: "Failed to parse JSON response",
          details: { url, error: e.message }
        };
      }
    }
    
    return { success: true };
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (controller && err.name === "AbortError") {
      return {
        success: false,
        message: `Request timed out after ${timeout}ms`,
        details: { url }
      };
    }
    
    return {
      success: false,
      message: `Failed to reach ${url}: ${err.message}`,
      details: { url, error: err.message }
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Wait for server to be ready with multiple retry attempts
 */
async function waitForServerReady(maxAttempts = 10, baseDelay = 2000): Promise<void> {
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[e2e:enhanced-setup] Health check attempt ${attempt}/${maxAttempts}...`);
    
    // Check API health
    const healthResult = await probe("/api/health", {
      accept: "application/json",
      expectedJsonProps: { status: ["ok", "degraded"] }, // Accept both ok and degraded
      timeout: 5000
    });
    
    if (!healthResult.success) {
      lastError = `Health check failed: ${healthResult.message}`;
      console.warn(`[e2e:enhanced-setup] ${lastError}`);
      
      // If this is not the last attempt, wait and retry
      if (attempt < maxAttempts) {
        const delay = baseDelay * attempt; // Exponential backoff
        console.log(`[e2e:enhanced-setup] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    } else {
      // Health check passed, now check the locale-prefixed page
      console.log("[e2e:enhanced-setup] API health check passed, checking locale routing...");
      
      const localeResult = await probe("/en", {
        accept: "text/html",
        expectedStatus: 200,
        timeout: 5000
      });
      
      if (!localeResult.success) {
        lastError = `Locale check failed: ${localeResult.message}`;
        console.warn(`[e2e:enhanced-setup] ${lastError}`);
        
        if (attempt < maxAttempts) {
          const delay = baseDelay * attempt;
          console.log(`[e2e:enhanced-setup] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } else {
        // Both checks passed!
        console.log("[e2e:enhanced-setup] ��� � � ✓ Server is healthy - /api/health and /en both resolve.");
        return;
      }
    }
  }
  
  // If we get here, all attempts failed
  throw new Error(
    `[e2e:enhanced-setup] Server health check failed after ${maxAttempts} attempts. ` +
    `Last error: ${lastError}\n\n` +
    `Troubleshooting suggestions:\n` +
    `1. Check if dev server is running: lsof -i:4000\n` +
    `2. Check server logs for errors\n` +
    `3. Try manually: pnpm dev\n` +
    `4. Check if port 4000 is blocked or used by another service\n` +
    `5. Verify Next.js and dependencies are installed correctly`
  );
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  console.log("[e2e:enhanced-setup] Starting enhanced server health validation...");
  
  // Step 1: Clean up any existing server processes to ensure clean state
  cleanupExistingServer();
  
  // Step 2: Wait for server to be ready with retries
  await waitForServerReady();
  
  console.log("[e2e:enhanced-setup] Enhanced setup completed successfully.");
}
