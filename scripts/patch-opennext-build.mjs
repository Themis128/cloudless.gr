#!/usr/bin/env node
/**
 * Patch script for OpenNext.js Cloudflare build to support Next.js 16.3.0-preview.6.
 *
 * Next.js 16 emits middleware bundles under `.next/server/edge/chunks/...` but
 * OpenNext expects the legacy flat path `.next/server/middleware.js[.map][.nft.json]`.
 *
 * This script patches @opennextjs/cloudflare/dist/cli/build/build.js to run the middleware fix
 * AFTER the Next.js build completes (after buildNextjsApp(options)).
 */

import fs from "node:fs";
import path from "node:path";

// Dynamic search to find @opennextjs+cloudflare with any Next.js 16 version
function findCloudflareBuildJs() {
  const pnpmDir = path.join(process.cwd(), "node_modules", ".pnpm");
  if (!fs.existsSync(pnpmDir)) {
    return null;
  }

  const entries = fs.readdirSync(pnpmDir);
  for (const entry of entries) {
    // Match @opennextjs+cloudflare with Next.js 16 (preview or canary)
    if (entry.includes("@opennextjs+cloudflare") && entry.includes("next@16.")) {
      const candidate = path.join(pnpmDir, entry, "node_modules", "@opennextjs", "cloudflare", "dist", "cli", "build", "build.js");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  // Fallback: check if there's a @opennextjs/cloudflare symlink directly
  const symlinkPath = path.join(process.cwd(), "node_modules", "@opennextjs", "cloudflare", "dist", "cli", "build", "build.js");
  if (fs.existsSync(symlinkPath)) {
    return symlinkPath;
  }
  return null;
}

const targetFile = findCloudflareBuildJs();

if (!targetFile) {
  console.error("[patch-opennext-build] Could not find @opennextjs/cloudflare/dist/cli/build/build.js");
  console.error("[patch-opennext-build] Make sure @opennextjs/cloudflare is installed with Next.js 16+");
  process.exit(1);
}

console.log("[patch-opennext-build] Found:", targetFile);

let content = fs.readFileSync(targetFile, "utf8");

if (content.includes("Cloudless middleware patch")) {
  console.log("[patch-opennext-build] Already patched");
  process.exit(0);
}

// Inject middleware fix after the Next.js build completes (after buildNextjsApp(options);)
const patchCode = `
    // Cloudless middleware patch: bridge Next.js 16 edge/chunks output to legacy middleware.js path
    var { execSync } = require("node:child_process");
    try {
        execSync("node scripts/opennext-middleware-fix.mjs", { cwd: process.cwd(), stdio: "ignore" });
    } catch {}
`;

// The pattern in the Cloudflare build.js is:
// buildNextjsApp(options);
// }
// // Make sure no Node.js middleware is used
const originalPattern = /buildNextjsApp\(options\);\s*\n\s*\}\s*\n\s*\/\/ Make sure no Node\.js middleware is used/;

if (originalPattern.test(content)) {
  content = content.replace(
    originalPattern,
    `buildNextjsApp(options);\n${patchCode}\n    }\n    // Make sure no Node.js middleware is used`
  );
} else {
  // Try alternative pattern - just inject after buildNextjsApp(options);
  const altPattern = /buildNextjsApp\(options\);\s*\n\s*\}/;
  if (altPattern.test(content)) {
    content = content.replace(
      altPattern,
      `buildNextjsApp(options);\n${patchCode}\n    }`
    );
  } else {
    console.error("[patch-opennext-build] Warning: Could not find expected pattern in build.js");
    console.error("[patch-opennext-build] The file may have been updated. Manual intervention may be required.");
    process.exit(1);
  }
}

fs.writeFileSync(targetFile, content);
console.log("[patch-opennext-build] Patched successfully for Next.js 16.3.0-preview.6 compatibility");