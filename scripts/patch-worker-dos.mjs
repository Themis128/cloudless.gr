#!/usr/bin/env node
/**
 * Patch OpenNext worker.js to export custom Durable Object classes (CounterAgent, EchoAgent, CodingAgent).
 * Copy agent source files to .open-next and export them from the worker.
 * Strip TypeScript syntax since Wrangler/esbuild compiles JS, not TS.
 */
import fs from "node:fs";
import path from "node:path";

const workerPath = path.resolve(".open-next/worker.js");
if (!fs.existsSync(workerPath)) {
  console.log("[patch-worker-dos] worker.js not found — skip");
  process.exit(0);
}

let content = fs.readFileSync(workerPath, "utf8");

// Check if already patched
if (content.includes("export { CounterAgent }")) {
  console.log("[patch-worker-dos] Already patched — skip");
  process.exit(0);
}

// Copy agent files to .open-next/.build/agents (where worker can import from)
const agentsDestDir = path.resolve(".open-next/.build/agents");
if (!fs.existsSync(agentsDestDir)) {
  fs.mkdirSync(agentsDestDir, { recursive: true });
}

// Copy TypeScript source files as .js and strip TypeScript syntax
const agentFiles = [
  "src/agents/counter.ts",
  "src/agents/echo.ts",
  "src/agents/coding.ts"
];

function stripTypescript(content) {
  // Remove type annotations: `type Env = ...` -> remove entirely
  content = content.replace(/type\s+\w+\s*=\s*[^;]+;/g, '');
  // Remove type imports
  content = content.replace(/import\s+type\s+[^;]+;/g, '');
  // Remove type annotations on variables: `: Type` 
  content = content.replace(/:\s*\w+(?:<\w+(?:,\s*\w+)*>)?/g, '');
  // Remove `implements` clause
  content = content.replace(/implements\s+\w+(?:<\w+>)?\s*/g, '');
  // Remove generic type parameters: `<...>`
  content = content.replace(/<[^<>]+>/g, '');
  // Remove interface/type declarations
  content = content.replace(/(interface|type)\s+\w+\s*\{[^}]+\}/g, '');
  return content;
}

for (const srcPath of agentFiles) {
  const destPath = path.join(agentsDestDir, path.basename(srcPath).replace(".ts", ".js"));
  if (fs.existsSync(srcPath)) {
    let srcContent = fs.readFileSync(srcPath, "utf8");
    // Strip TypeScript-specific syntax
    srcContent = stripTypescript(srcContent);
    fs.writeFileSync(destPath, srcContent);
    console.log(`[patch-worker-dos] Copied and stripped ${srcPath} -> ${destPath}`);
  } else {
    console.log(`[patch-worker-dos] WARNING: ${srcPath} not found`);
  }
}

// Import the agent classes from .open-next/.build/agents
const patch = `
// ==========================================
// Custom Durable Object exports for Cloudflare Agents SDK
// These must be exported from the Worker for DO bindings to work
// ==========================================
import { CounterAgent } from "./.build/agents/counter.js";
import { EchoAgent } from "./.build/agents/echo.js";
import { CodingAgent } from "./.build/agents/coding.js";

export { CounterAgent };
export { EchoAgent };
export { CodingAgent };

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

fs.writeFileSync(workerPath, content);
console.log("[patch-worker-dos] Added CounterAgent, EchoAgent, CodingAgent exports to worker.js");