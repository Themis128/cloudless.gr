#!/usr/bin/env node

/**
 * CMS parity probe for the Notion → AppFlowy dual-run cutover.
 *
 * Usage:
 *   CMS_PARITY_BASE_URL=http://localhost:4000 node scripts/cms-parity-check.mjs
 */

const baseUrl = process.env.CMS_PARITY_BASE_URL || "http://localhost:4000";

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

async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(15_000) });
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
      report.checks[ep.key] = {
        path: ep.path,
        ok: result.ok,
        status: result.status,
        source,
        count,
      };
      if (!result.ok) report.ok = false;
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
