#!/usr/bin/env node
/**
 * Post-build fix for Next.js 16 + OpenNext middleware path mismatch.
 *
 * Next.js 16 emits middleware bundles under:
 *   .next/server/edge/chunks/...edge-wrapper-*.js
 *
 * OpenNext expects the legacy flat path:
 *   .next/server/middleware.js[.map][.nft.json]
 *
 * This script bridges that gap so `pnpm cf:build` can complete.
 */

import fs from "node:fs";
import path from "node:path";

const nextDir = path.join(process.cwd(), ".next", "server");
const edgeDir = path.join(nextDir, "edge", "chunks");

let patched = false;

function copyIfMissing(target, source) {
  if (fs.existsSync(target)) {
    return false;
  }
  if (!fs.existsSync(source)) {
    return false;
  }
  fs.copyFileSync(source, target);
  patched = true;
  return true;
}

// Locate middleware wrapper bundle(s) emitted by Next 16 in edge/chunks.
const candidates = fs.existsSync(edgeDir)
  ? fs.readdirSync(edgeDir).filter((f) => f.includes("edge-wrapper") && f.endsWith(".js"))
  : [];

if (candidates.length > 0) {
  // Prefer a canonical wrapper if present, otherwise take the last match.
  const preferred =
    candidates.find((f) => f.includes("_0oh4-7w.js")) ||
    candidates.find((f) => f.endsWith(".js")) ||
    null;

  if (preferred) {
    const base = preferred;
    const mapBase = preferred.replace(/\.js$/, ".js.map");

    copyIfMissing(path.join(nextDir, "middleware.js"), path.join(edgeDir, base));
    copyIfMissing(
      path.join(nextDir, "middleware.js.map"),
      path.join(edgeDir, mapBase),
    );
  }
}

// Legacy Next.js builds also emit middleware.js.nft.json alongside middleware.js.
// If the JSON file is missing, create a stub so OpenNext does not ENOENT.
const nftPath = path.join(nextDir, "middleware.js.nft.json");
if (!fs.existsSync(nftPath)) {
  fs.writeFileSync(nftPath, "{}");
  patched = true;
}

if (patched) {
  console.log("[opennext-middleware-fix] Patched .next/server for OpenNext middleware compatibility.");
} else {
  console.log("[opennext-middleware-fix] No patch needed.");
}