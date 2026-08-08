#!/usr/bin/env node
/**
 * Patch OpenNext worker.js to export custom Durable Object classes.
 * 
 * IMPORTANT: The Cloudflare Agents SDK (CounterAgent, EchoAgent, CodingAgent) 
 * extends `Agent` from the `agents` package which requires the Cloudflare Agents 
 * runtime. These CANNOT be bundled into the Next.js worker.js — they must be 
 * deployed as standalone Durable Objects via wrangler.jsonc DO bindings.
 * 
 * This script now only exports the OpenNext built-in Durable Objects:
 * - DOQueueHandler
 * - DOShardedTagCache  
 * - BucketCachePurge
 * 
 * The custom agents (CounterAgent, EchoAgent, CodingAgent) are available 
 * automatically via the Durable Object bindings defined in wrangler.jsonc.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workerPath = path.resolve(".open-next/worker.js");
const workerDir = path.dirname(workerPath);

try {
  let content = fs.readFileSync(workerPath, "utf8");

  // Check if already patched with the correct exports
  if (content.includes("export { DOQueueHandler }") && content.includes("export { DOShardedTagCache }")) {
    console.log("[patch-worker-dos] Already patched with OpenNext DO exports — skip");
    process.exit(0);
  }

  // Remove any existing agent imports/exports that may have been added incorrectly
  content = content.replace(/import\s+\{\s*CounterAgent\s*\}\s+from\s+[^;]+;/g, '');
  content = content.replace(/import\s+\{\s*EchoAgent\s*\}\s+from\s+[^;]+;/g, '');
  content = content.replace(/import\s+\{\s*CodingAgent\s*\}\s+from\s+[^;]+;/g, '');
  content = content.replace(/export\s+\{\s*CounterAgent\s*\}\s*;?/g, '');
  content = content.replace(/export\s+\{\s*EchoAgent\s*\}\s*;?/g, '');
  content = content.replace(/export\s+\{\s*CodingAgent\s*\}\s*;?/g, '');

  // Import the OpenNext built-in Durable Objects
  const patch = `
// ==========================================
// OpenNext built-in Durable Object exports
// These are required for OpenNext's internal queue, tag cache, and cache purge
// ==========================================
//@ts-expect-error: Will be resolved by wrangler build
export { DOQueueHandler } from "./.build/durable-objects/queue.js";
//@ts-expect-error: Will be resolved by wrangler build
export { DOShardedTagCache } from "./.build/durable-objects/sharded-tag-cache.js";
//@ts-expect-error: Will be resolved by wrangler build
export { BucketCachePurge } from "./.build/durable-objects/bucket-cache-purge.js";

// NOTE: CounterAgent, EchoAgent, CodingAgent are deployed as standalone
// Durable Objects via wrangler.jsonc DO bindings. They use the Cloudflare
// Agents SDK which requires its own runtime and CANNOT be bundled here.
// They are available via the DO bindings: env.CounterAgent, env.EchoAgent, env.CodingAgent

`;

  // Find the last import statement and add our patch after it
  const lastImportIndex = content.lastIndexOf("import ");
  if (lastImportIndex !== -1) {
    // Find the end of that line
    const lineEnd = content.indexOf("\n", lastImportIndex);
    content = content.slice(0, lineEnd + 1) + patch + content.slice(lineEnd + 1);
  } else {
    // Fallback: add at the top after any existing imports
    content = patch + content;
  }

  // Atomic write: write to temp file then rename
  const tempPath = path.join(workerDir, `.worker.js.tmp.${process.pid}.${Date.now()}`);
  fs.writeFileSync(tempPath, content);
  fs.renameSync(tempPath, workerPath);
  console.log("[patch-worker-dos] Added OpenNext DO exports to worker.js (CounterAgent/EchoAgent/CodingAgent are deployed via wrangler.jsonc bindings)");
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log("[patch-worker-dos] worker.js not found — skip");
    process.exit(0);
  }
  throw error;
}