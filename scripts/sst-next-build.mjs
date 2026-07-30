#!/usr/bin/env node
/**
 * SST / OpenNext AWS `pnpm build` entrypoint.
 *
 * Next.js 16 finalization opens `.next/server/middleware.js.nft.json`, but it
 * never emits that legacy file (edge wrapper lives under edge/chunks). A
 * pre-build stub is wiped when `next build` recreates `.next/`, so we keep the
 * stub present for the whole build, then run the OpenNext middleware bridge.
 *
 * When `scripts/cf-build-wrapper.sh` already ran `next build` and then invokes
 * `opennextjs-cloudflare build`, OpenNext calls `pnpm build` again. That second
 * pass must no-op: re-running `next build` races `rmdir .next/server` (ENOTEMPTY).
 * Guard: OPEN_NEXT_BUILD_ACTIVE=1 from the wrapper.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const serverDir = path.join(root, ".next", "server");
const nftPath = path.join(serverDir, "middleware.js.nft.json");
const middlewareJsPath = path.join(serverDir, "middleware.js");

if (process.env.OPEN_NEXT_BUILD_ACTIVE === "1") {
  const hasManifest = fs.existsSync(path.join(serverDir, "middleware-manifest.json"));
  if (hasManifest) {
    console.warn(
      "[sst-next-build] OPEN_NEXT_BUILD_ACTIVE — skipping nested next build (reuse existing .next).",
    );
    process.exit(0);
  }
  console.warn(
    "[sst-next-build] OPEN_NEXT_BUILD_ACTIVE set but .next/server incomplete — running next build.",
  );
}

function ensureMiddlewareStubs() {
  try {
    if (!fs.existsSync(serverDir)) return;
    // Use exclusive create (wx) to avoid TOCTOU races flagged by CodeQL js/file-system-race.
    try {
      fs.writeFileSync(middlewareJsPath, "// middleware stub for Next 16 finalization\n", {
        flag: "wx",
      });
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code !== "EEXIST") throw err;
    }
    try {
      fs.writeFileSync(nftPath, JSON.stringify({ files: ["middleware.js"] }), { flag: "wx" });
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code !== "EEXIST") throw err;
    }
  } catch {
    // Best-effort — next may race mkdir/rmdir during clean.
  }
}

const poll = setInterval(ensureMiddlewareStubs, 50);
ensureMiddlewareStubs();

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  clearInterval(poll);
  ensureMiddlewareStubs();

  const fix = spawn(process.execPath, [path.join(root, "scripts", "opennext-middleware-fix.mjs")], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  fix.on("exit", () => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    // If Next only failed because the stub was briefly missing, but the build
    // tree + nft stub now exist, treat as success so OpenNext can continue.
    if (
      code !== 0 &&
      fs.existsSync(nftPath) &&
      fs.existsSync(middlewareJsPath) &&
      fs.existsSync(path.join(serverDir, "middleware-manifest.json"))
    ) {
      console.warn(
        "[sst-next-build] next build exited non-zero but middleware stubs + manifest exist; continuing.",
      );
      process.exit(0);
      return;
    }
    process.exit(code ?? 1);
  });
});
