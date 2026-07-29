#!/usr/bin/env node
/**
 * SST / OpenNext AWS `pnpm build` entrypoint.
 *
 * Next.js 16 finalization opens `.next/server/middleware.js.nft.json`, but it
 * never emits that legacy file (edge wrapper lives under edge/chunks). A
 * pre-build stub is wiped when `next build` recreates `.next/`, so we keep the
 * stub present for the whole build, then run the OpenNext middleware bridge.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const serverDir = path.join(root, ".next", "server");
const nftPath = path.join(serverDir, "middleware.js.nft.json");

function ensureNftStub() {
  try {
    if (!fs.existsSync(serverDir)) return;
    if (fs.existsSync(nftPath)) return;
    fs.writeFileSync(nftPath, JSON.stringify({ files: [] }));
  } catch {
    // Best-effort — next may race mkdir/rmdir during clean.
  }
}

const poll = setInterval(ensureNftStub, 50);
ensureNftStub();

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  clearInterval(poll);
  ensureNftStub();

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
    if (code !== 0 && fs.existsSync(nftPath) && fs.existsSync(path.join(serverDir, "middleware-manifest.json"))) {
      console.warn(
        "[sst-next-build] next build exited non-zero but middleware NFT + manifest exist; continuing.",
      );
      process.exit(0);
      return;
    }
    process.exit(code ?? 1);
  });
});
