#!/usr/bin/env python3
"""Cloudflare/OpenNext build wrapper.

Guard against recursion: OpenNext calls `buildCommand` internally, which
execs `pnpm build`. In the recursive call we must NOT run `next build`
again — the first build already produced .next/, and re-running cleans
it then leaves it incomplete (useTypeScriptCli fails) → ENOENT in
OpenNext's bundle phase. In that case we only ensure the middleware stub
exists and exit 0.

NOTE: package.json "build" is scripts/sst-next-build.mjs. OpenNext's
nested `pnpm build` hits that script — it also honors
OPEN_NEXT_BUILD_ACTIVE."""

import gzip
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)


def sh(*args: str, env_extra: dict | None = None) -> int:
    env = {**os.environ, **(env_extra or {})}
    return subprocess.call(list(args), env=env)


def node(script: str) -> int:
    return sh("node", f"scripts/{script}")


if os.environ.get("OPEN_NEXT_BUILD_ACTIVE"):
    print("⚠ Recursive build detected — skipping next build (already "
          "built above)...")
    node("opennext-middleware-fix.mjs")
    sys.exit(0)

os.environ["OPEN_NEXT_BUILD_ACTIVE"] = "1"
os.environ["CF_BUILD_WRAPPER_ACTIVE"] = "1"

# Clean previous OpenNext output to avoid stale artifacts
shutil.rmtree(".open-next", ignore_errors=True)

# SSM_DISABLED=1 prevents AWS SSM calls during static generation —
# the build env has no AWS credentials; the deployed app uses D1
# app_config / Wrangler secrets.
os.environ["SSM_DISABLED"] = "1"

print("▶ Patching OpenNext for Next.js 16.3.0-preview.6 middleware "
      "compatibility...")
rc = node("patch-opennext-build.mjs")
if rc:
    sys.exit(rc)

print("▶ Running Next.js build...")
# Keep middleware.js.nft.json present for the whole build — Next 16
# finalization opens it, but recreating `.next/` wipes a pre-build stub.
os.environ["NEXT_OUTPUT_STANDALONE"] = "1"
rc = node("sst-next-build.mjs")
if rc:
    sys.exit(rc)
print("⚠ Next.js build completed (SST wrapper keeps middleware NFT "
      "stub alive)")

print("▶ Ensuring standalone build files exist for OpenNext...")
Path(".next/standalone/.next").mkdir(parents=True, exist_ok=True)
if Path(".next/server").is_dir():
    shutil.copytree(".next/server", ".next/standalone/.next/server",
                    dirs_exist_ok=True)
if Path(".next/BUILD_ID").exists():
    shutil.copy(".next/BUILD_ID", ".next/standalone/.next/BUILD_ID")
for name in ("app", "chunks", "edge", "functions-config-manifest.json",
             "middleware", "middleware-build-manifest.js",
             "middleware-manifest.json", "next-font-manifest.js",
             "pages-manifest.json", "prefetch-hints.json",
             "server-reference-manifest.js",
             "required-server-files.json"):
    src = Path(f".next/{name}")
    dst = Path(f".next/standalone/.next/{name}")
    try:
        if src.is_dir():
            shutil.copytree(src, dst, dirs_exist_ok=True)
        elif src.exists():
            shutil.copy(src, dst)
    except OSError:
        pass
try:
    shutil.copy("package.json", ".next/standalone/package.json")
except OSError:
    pass
print("▶ Standalone build files ensured")

print("▶ Ensuring middleware.js.nft.json stub exists for OpenNext...")
node("opennext-middleware-fix.mjs")

print("▶ Running OpenNext Cloudflare build...")
rc = sh("pnpm", "exec", "opennextjs-cloudflare", "build",
        "--openNextConfigPath", "open-next.config.cloudflare.ts",
        env_extra={"NEXT_TELEMETRY_DISABLED": "1"})
if rc:
    sys.exit(rc)

# Patch worker.js to export custom Durable Objects
node("patch-worker-dos.mjs")

# Free plan = 3 MiB gzip Worker script. Strip OG fonts/WASM + .bin
# stubs so we stay under the limit without Workers Paid.
print("▶ Slimming OpenNext output for Workers Free (strip OG + .bin "
      "fonts)...")
node("strip-opennext-bin-fonts.mjs")
node("strip-opennext-vercel-og.mjs")
node("strip-yoga-wasm.mjs")

worker = Path(".open-next/worker.js")
if worker.is_file():
    size = len(gzip.compress(worker.read_bytes()))
    print(f"▶ worker.js gzip ≈ {size / 1024 / 1024:.2f} MiB "
          "(free limit 3.00)")

print("✅ Cloudflare build complete")
