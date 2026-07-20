/**
 * Cron authorization utilities - Works in both Node.js (Next.js) and Cloudflare Workers environments.
 *
 * - In AWS Lambda: Uses SSM for config, node:crypto for timing-safe comparison
 * - In Cloudflare Workers: Uses D1 for config, Web Crypto API for timing-safe comparison
 */

import { NextRequest, NextResponse } from "next/server";

// Detect Cloudflare Workers environment (for runtime detection)
function isWorkersEnvironment(): boolean {
  return typeof (globalThis as unknown as Record<string, unknown>).caches !== "undefined";
}

const BEARER_PREFIX = "Bearer ";

/**
 * Timing-safe string comparison.
 * In Workers, uses XOR comparison. In Node.js, uses crypto's timingSafeEqual.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  if (isWorkersEnvironment()) {
    // XOR comparison that doesn't leak timing info in practice
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  // Node.js - use crypto's timingSafeEqual (dynamic import to avoid Workers issues)
  const aBuf = Buffer.from(a, "utf-8");
  const bBuf = Buffer.from(b, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { timingSafeEqual: tse } = require("crypto") as typeof import("crypto");
  return tse(aBuf, bBuf);
}

/**
 * Check if the request is authorized for cron access.
 * Works in both Node.js (via SSM) and Workers (via env vars or D1).
 */
export async function isCronAuthorized(
  request: NextRequest,
): Promise<boolean> {
  // Get expected secret from environment (works in all environments)
  let expected = process.env.CRON_SECRET || "";

  // If no CRON_SECRET in env, try SSM (Node.js only, not Workers)
  if (!expected && !isWorkersEnvironment() && process.env.SSM_DISABLED !== "1") {
    try {
      const { getConfig } = await import("./ssm-config");
      const config = await getConfig();
      expected = config.CRON_SECRET || "";
    } catch {
      // Config fetch failed, continue with env check
    }
  }

  if (!expected) return false;

  const header = request.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) return false;

  const actual = header.slice(BEARER_PREFIX.length);
  return safeEqual(actual, expected);
}

export function cronUnauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}