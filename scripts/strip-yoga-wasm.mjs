#!/usr/bin/env node
/**
 * Strip yoga.wasm and resvg.wasm imports with duplicated absolute paths from OpenNext output.
 * These imports have duplicated paths that cause ENOENT errors during deployment.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".open-next/server-functions/default");
const handlerPath = path.join(root, "handler.mjs");
const handlerDir = path.dirname(handlerPath);

try {
  let content = fs.readFileSync(handlerPath, "utf8");

  // The actual path pattern in the file is:
  // /home/tbaltzakis/cloudless.gr/.open-next/server-functions/default/node_modules/.pnpm/next@16.3.0-preview.6_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.62_c2fcc6a3f178753e1cd2e6357a092405/node_modules/next/dist/compiled/@vercel/og/yoga.wasm?module

  // Fix: Replace the entire absolute path with the package-relative path
  content = content.replace(
    /\/home\/[^"]+\.open-next\/server-functions\/default\/node_modules\/\.pnpm\/[^"]+\/node_modules\/next\/dist\/compiled\/@vercel\/og\/yoga\.wasm\?module/g,
    'next/dist/compiled/@vercel/og/yoga.wasm?module'
  );

  content = content.replace(
    /\/home\/[^"]+\.open-next\/server-functions\/default\/node_modules\/\.pnpm\/[^"]+\/node_modules\/next\/dist\/compiled\/@vercel\/og\/resvg\.wasm\?module/g,
    'next/dist/compiled/@vercel/og/resvg.wasm?module'
  );

  // Also fix any require() calls
  content = content.replace(
    /require\(\s*"\/home\/[^"]+\/yoga\.wasm\?module"\s*\)/g,
    'require("next/dist/compiled/@vercel/og/yoga.wasm?module")'
  );

  content = content.replace(
    /require\(\s*"\/home\/[^"]+\/resvg\.wasm\?module"\s*\)/g,
    'require("next/dist/compiled/@vercel/og/resvg.wasm?module")'
  );

  // Pattern 3: Any remaining absolute paths that include the project path twice
  content = content.replace(
    /(["'])\/home\/[^"']+\.open-next\/server-functions\/default\/home\/[^"']+/g,
    '$1'
  );

  // Atomic write: write to temp file then rename
  const tempPath = path.join(handlerDir, `.handler.mjs.tmp.${process.pid}.${Date.now()}`);
  fs.writeFileSync(tempPath, content);
  fs.renameSync(tempPath, handlerPath);
  console.log("[strip-yoga-wasm] Fixed duplicated path imports in handler.mjs");
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log("[strip-yoga-wasm] handler.mjs not found — skip");
    process.exit(0);
  }
  throw error;
}