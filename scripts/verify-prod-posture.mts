/**
 * Verify the live cloudless.gr (and cloudless.online standby) posture
 * against the targets documented in docs/security.md and the
 * encryption/compression contract.
 *
 * Run:
 *   pnpm tsx scripts/verify-prod-posture.mts
 *   pnpm tsx scripts/verify-prod-posture.mts cloudless.online   # check standby
 *
 * Exits 0 if every check passes, 1 if any fail. Designed to be wired
 * into a periodic Claude Code routine or a manual-dispatch CI job.
 */

import { connect, type TLSSocket } from "node:tls";
import { request as httpsRequest } from "node:https";

const HOST = process.argv[2] ?? "cloudless.gr";
const PORT = 443;

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const results: Check[] = [];
function record(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
}

// ───────────────────────────────────────────────────────────────────────
// TLS posture: protocol + cipher
// ───────────────────────────────────────────────────────────────────────
async function probeTls(): Promise<void> {
  return new Promise<void>((resolve) => {
    const socket: TLSSocket = connect(
      { host: HOST, port: PORT, servername: HOST, ALPNProtocols: ["h2", "http/1.1"] },
      () => {
        const protocol = socket.getProtocol();
        const cipher = socket.getCipher();
        const alpn = socket.alpnProtocol;
        record(
          "TLS protocol >= 1.2",
          protocol === "TLSv1.2" || protocol === "TLSv1.3",
          `negotiated ${protocol}`,
        );
        record(
          "TLS cipher is AEAD (GCM or CHACHA20)",
          /(GCM|CHACHA20)/.test(cipher.name),
          `${cipher.name} (${cipher.standardName ?? "?"})`,
        );
        record(
          "ALPN advertises h2 (HTTP/2)",
          alpn === "h2",
          `negotiated ${alpn ?? "none"}`,
        );
        socket.end();
        resolve();
      },
    );
    socket.on("error", (err) => {
      record("TLS handshake", false, `error: ${err.message}`);
      resolve();
    });
  });
}

// ───────────────────────────────────────────────────────────────────────
// HTTP/2 + compression + HSTS
// ───────────────────────────────────────────────────────────────────────
function fetchHeaders(
  path: string,
  acceptEncoding: string,
): Promise<{ status: number; headers: NodeJS.Dict<string | string[]>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host: HOST,
        port: PORT,
        path,
        method: "GET",
        headers: { "accept-encoding": acceptEncoding, "user-agent": "verify-prod-posture" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function probeCompressionAndHeaders(): Promise<void> {
  // Follow exactly one 307 redirect manually (root /-redirect-to-/en).
  let res = await fetchHeaders("/", "br, gzip");
  if (res.status === 307 || res.status === 308) {
    const loc = res.headers["location"] as string | undefined;
    if (loc) {
      const url = new URL(loc, `https://${HOST}/`);
      res = await fetchHeaders(url.pathname + url.search, "br, gzip");
    }
  }

  const ce = (res.headers["content-encoding"] as string | undefined) ?? "";
  record(
    "HTML response advertises brotli or gzip",
    ce === "br" || ce === "gzip",
    `Content-Encoding=${ce || "(none)"}`,
  );

  const hsts = (res.headers["strict-transport-security"] as string | undefined) ?? "";
  const m = /max-age=(\d+)/.exec(hsts);
  const maxAge = m ? Number(m[1]) : 0;
  record(
    "HSTS max-age >= 1 year (preload-eligible)",
    maxAge >= 31_536_000,
    `max-age=${maxAge}`,
  );
  record(
    "HSTS includeSubDomains + preload",
    hsts.includes("includeSubDomains") && hsts.includes("preload"),
    hsts,
  );

  const xPowered = res.headers["x-powered-by"] as string | undefined;
  record(
    "X-Powered-By is suppressed",
    xPowered === undefined,
    xPowered ? `leaks: ${xPowered}` : "absent",
  );

  // /api/health is intentionally tiny (72B) so compression is correctly absent.
  const health = await fetchHeaders("/api/health", "br, gzip");
  const healthCe = (health.headers["content-encoding"] as string | undefined) ?? "";
  record(
    "/api/health (small payload) does NOT inflate by compressing",
    healthCe === "" || healthCe === "identity",
    `Content-Encoding=${healthCe || "(none)"}, body=${health.body.length}B`,
  );
}

// ───────────────────────────────────────────────────────────────────────
// Print results table + exit code
// ───────────────────────────────────────────────────────────────────────
function report(): number {
  const colWidth = Math.max(...results.map((r) => r.name.length), 30);
  console.log(`\nPosture verification → ${HOST}\n`);
  console.log(`  ${"check".padEnd(colWidth)}  result   detail`);
  console.log(`  ${"-".repeat(colWidth)}  -------  ${"-".repeat(40)}`);
  for (const r of results) {
    const mark = r.ok ? "✓ pass" : "✗ FAIL";
    console.log(`  ${r.name.padEnd(colWidth)}  ${mark}    ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  const passed = results.length - failed;
  console.log(`\n  ${passed} pass / ${failed} fail\n`);
  return failed === 0 ? 0 : 1;
}

await probeTls();
await probeCompressionAndHeaders();
process.exit(report());
