#!/usr/bin/env node
/**
 * Post-build fix for Next.js 16 + OpenNext middleware path mismatch.
 *
 * Next.js 16 (Turbopack) emits middleware bundles under:
 *   .next/server/edge/chunks/...edge-wrapper-*.js
 *
 * OpenNext expects the legacy flat path:
 *   .next/server/middleware.js[.map][.nft.json]
 *
 * This script bridges that gap so `pnpm cf:build` can complete.
 *
 * It is called multiple times during the build:
 *   1. Pre-build (before next build) — edge chunks don't exist yet
 *   2. Post-build (after next build, before OpenNext) — edge chunks exist
 *   3. During OpenNext build (patched build.js) — edge chunks exist
 *
 * We always overwrite the nft.json so the latest state is reflected.
 */

import fs from "node:fs";
import path from "node:path";

const nextDir = path.join(process.cwd(), ".next", "server");
const edgeDir = path.join(nextDir, "edge", "chunks");
const standaloneServerDir = path.join(process.cwd(), ".next", "standalone", ".next", "server");

let patched = false;

// Ensure the .next/server directory exists before we try to write files into it.
try {
  fs.mkdirSync(nextDir, { recursive: true });
} catch (e) {
  // Directory might already exist or be created by Next.js build
}

function copyIfMissing(target, source) {
  if (fs.existsSync(target)) {
    return false;
  }
  if (!fs.existsSync(source)) {
    return false;
  }
  try {
    fs.copyFileSync(source, target);
    patched = true;
    return true;
  } catch {
    return false;
  }
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

// OpenNext's copyTracedFiles reads middleware.js.nft.json and expects a "files"
// array. Next.js 16 (Turbopack) does not emit this file in the legacy format.
// We always overwrite it (not just create-if-missing) because this script is
// called multiple times during the build and the middleware.js may not exist
// on the first call (pre-build).
//
// The old stub "{}" caused processNftFile() to throw a TypeError on
// undefined .files, which computeCopyFilesForPage caught, found middleware.js
// on disk, and threw "middleware cannot use the edge runtime".
const middlewareJsPath = path.join(nextDir, "middleware.js");
const nftPath = path.join(nextDir, "middleware.js.nft.json");
try {
  const parentDir = path.dirname(nftPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  // Only include middleware.js in the files array if the file actually exists.
  const nftContent = fs.existsSync(middlewareJsPath)
    ? JSON.stringify({ files: ["middleware.js"] })
    : JSON.stringify({ files: [] });
  fs.writeFileSync(nftPath, nftContent);
  patched = true;
} catch (err) {
  console.error("[opennext-middleware-fix] Failed to write middleware.js.nft.json:", err.message);
}

// Also sync middleware.js to the standalone directory if it exists there.
// The cf-build-wrapper.sh copies .next/server → .next/standalone/.next/server
// BEFORE this script runs (post-build), so middleware.js may not be in
// standalone yet. We copy it here to ensure computeCopyFilesForPage can find it.
if (fs.existsSync(middlewareJsPath) && fs.existsSync(standaloneServerDir)) {
  try {
    copyIfMissing(
      path.join(standaloneServerDir, "middleware.js"),
      middlewareJsPath,
    );
    const mapSrc = path.join(nextDir, "middleware.js.map");
    if (fs.existsSync(mapSrc)) {
      copyIfMissing(
        path.join(standaloneServerDir, "middleware.js.map"),
        mapSrc,
      );
    }
  } catch (err) {
    // Non-fatal — standalone copy is best-effort
  }
}

if (patched) {
  console.log("[opennext-middleware-fix] Patched .next/server for OpenNext middleware compatibility.");
} else {
  console.log("[opennext-middleware-fix] No patch needed.");
}
