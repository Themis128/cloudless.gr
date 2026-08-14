#!/usr/bin/env node
/**
 * Static checks so Next.js Edge instrumentation never traces Node/React APIs.
 *
 * @see https://nextjs.org/docs/app/guides/instrumentation#importing-runtime-specific-code
 * @see https://github.com/vercel/next.js/issues/85938
 * @see https://github.com/vercel/next.js/issues/86479
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname ?? ".", "..");
const INSTRUMENTATION = resolve(root, "src/instrumentation.ts");
const NODE = resolve(root, "src/instrumentation.node.ts");
const FLAGS = resolve(root, "src/instrumentation-flags.ts");

let fails = 0;

function read(path) {
  if (!existsSync(path)) {
    console.error(`FAIL  missing ${path}`);
    fails += 1;
    return "";
  }
  return readFileSync(path, "utf8");
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function must(ok, msg) {
  if (ok) console.log(`ok    ${msg}`);
  else {
    console.error(`FAIL  ${msg}`);
    fails += 1;
  }
}

const inst = stripComments(read(INSTRUMENTATION));
const node = stripComments(read(NODE));
const flags = stripComments(read(FLAGS));

must(
  /NEXT_RUNTIME === ["']nodejs["'][\s\S]{0,160}import\(["']\.\/instrumentation\.node["']\)/.test(inst),
  "instrumentation.ts: inline NEXT_RUNTIME === 'nodejs' then dynamic import('./instrumentation.node')"
);
must(inst.includes("sentry.edge.config"), "instrumentation.ts: Edge Sentry import");
must(!inst.includes("sentry.server.config"), "instrumentation.ts: no Sentry server config");
must(!inst.includes("getCloudflareContext"), "instrumentation.ts: no getCloudflareContext");
must(!/node:sqlite|node:fs\b/.test(inst), "instrumentation.ts: no node:fs / node:sqlite");
must(
  !/from\s+["'][^"']*auth-db-local["']/.test(inst) &&
    !/require\(\s*["'][^"']*auth-db-local["']\s*\)/.test(inst) &&
    !/import\(\s*["'][^"']*auth-db-local["']\s*\)/.test(inst),
  "instrumentation.ts: no auth-db-local specifier"
);
must(!inst.includes("theme-pref"), "instrumentation.ts: no theme-pref");
must(!inst.includes("slack-notify"), "instrumentation.ts: no slack-notify");
must(!/node:sqlite|node:fs\b/.test(flags), "instrumentation-flags.ts: Edge-safe");
must(node.includes("sentry.server.config"), "instrumentation.node.ts: Sentry server");
must(node.includes("getCloudflareContext timed out"), "instrumentation.node.ts: remote D1 timeout");
must(
  !/require\(\s*["']\.\/lib\/auth-db-local["']\s*\)/.test(node) &&
    !/from\s+["']\.\/lib\/auth-db-local["']/.test(node) &&
    !/from\s+["']@\/lib\/auth-db-local["']/.test(node),
  "instrumentation.node.ts: no literal auth-db-local import (use computed require)"
);

if (fails > 0) {
  console.error(`\ninstrumentation-edge-doctor: ${fails} failure(s)`);
  process.exit(1);
}
console.log("\ninstrumentation-edge-doctor: ok");
