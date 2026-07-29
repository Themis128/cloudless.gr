#!/usr/bin/env node

/**
 * CMS parity probe for the Notion → AppFlowy dual-run cutover.
 *
 * Usage:
 *   CMS_PARITY_BASE_URL=http://localhost:4000 node scripts/cms-parity-check.mjs
 *
 * Cloudflare Access / bot bypass (optional):
 *   CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET
 *   or CMS_PARITY_HEADERS_JSON='{"Cookie":"...","cf-access-token":"..."}'
 *
 * Require AppFlowy as the active source on every endpoint:
 *   CMS_PARITY_REQUIRE_APPFLOWY=1
 */

const baseUrl = process.env.CMS_PARITY_BASE_URL || "http://localhost:4000";
const requireAppFlowy = process.env.CMS_PARITY_REQUIRE_APPFLOWY === "1";

const ENDPOINTS = [
  { key: "blogPosts", path: "/api/blog/posts", listKey: "posts", sourceHeader: "x-blog-source" },
  { key: "docs", path: "/api/docs", listKey: "docs", sourceHeader: "x-cms-source" },
  { key: "services", path: "/api/services", listKey: "services", sourceHeader: "x-cms-source" },
  { key: "faqs", path: "/api/faqs", listKey: null, sourceHeader: "x-cms-source" },
  {
    key: "testimonials",
    path: "/api/testimonials",
    listKey: null,
    sourceHeader: "x-cms-source",
  },
  {
    key: "caseStudies",
    path: "/api/case-studies",
    listKey: null,
    sourceHeader: "x-cms-source",
  },
];

function buildHeaders() {
  const headers = { Accept: "application/json" };

  if (process.env.CMS_PARITY_HEADERS_JSON) {
    try {
      Object.assign(headers, JSON.parse(process.env.CMS_PARITY_HEADERS_JSON));
    } catch (error) {
      throw new Error(
        `CMS_PARITY_HEADERS_JSON is not valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  const cfId = process.env.CF_ACCESS_CLIENT_ID;
  const cfSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (cfId && cfSecret) {
    headers["CF-Access-Client-Id"] = cfId;
    headers["CF-Access-Client-Secret"] = cfSecret;
  }

  return headers;
}

async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body, headers: res.headers };
}

function countItems(body, listKey) {
  if (listKey) {
    const list = body?.[listKey];
    return Array.isArray(list) ? list.length : 0;
  }
  return Array.isArray(body) ? body.length : 0;
}

async function run() {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    requireAppFlowy,
    checks: {},
    ok: true,
  };

  for (const ep of ENDPOINTS) {
    try {
      const result = await getJson(ep.path);
      const source =
        result.headers.get(ep.sourceHeader) ||
        result.body?.source ||
        (result.ok ? "unknown" : "error");
      const count = countItems(result.body, ep.listKey);
      const check = {
        path: ep.path,
        ok: result.ok,
        status: result.status,
        source,
        count,
      };
      if (!result.ok) {
        check.ok = false;
        report.ok = false;
      } else if (requireAppFlowy && source !== "appflowy") {
        check.ok = false;
        check.error = `expected source appflowy, got ${source}`;
        report.ok = false;
      }
      report.checks[ep.key] = check;
    } catch (error) {
      report.ok = false;
      report.checks[ep.key] = {
        path: ep.path,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const sources = Object.values(report.checks)
    .map((c) => c.source)
    .filter(Boolean);
  report.summary = {
    appflowyEndpoints: sources.filter((s) => s === "appflowy").length,
    notionEndpoints: sources.filter((s) => s === "notion").length,
    staticEndpoints: sources.filter((s) => s === "static").length,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
