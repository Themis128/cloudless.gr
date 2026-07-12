#!/usr/bin/env node
/**
 * Load testing script for Cloudflare Free Tier migration verification.
 * Tests under the 100K/day limit to ensure performance meets requirements.
 *
 * This script simulates realistic traffic patterns to:
 * 1. Verify Worker handles requests efficiently
 * 2. Check D1 query performance under concurrent load
 * 3. Validate R2 asset delivery
 * 4. Monitor endpoint response times
 *
 * Run with: node scripts/load-test.js [options]
 *
 * Options:
 *   --url <url>       Target URL (default: http://localhost:4000)
 *   --requests <n>    Number of requests (default: 1000)
 *   --concurrent <n>  Concurrent requests (default: 10)
 *   --pattern <type>  Traffic pattern: ramp, spike, steady (default: ramp)
 */

import { setTimeout } from "timers/promises";

interface LoadTestOptions {
  url: string;
  requests: number;
  concurrent: number;
  pattern: "ramp" | "spike" | "steady";
  delay: number;
}

interface TestResult {
  status: number;
  durationMs: number;
  error?: string;
}

function parseArgs(): LoadTestOptions {
  const args = process.argv.slice(2);
  const options: LoadTestOptions = {
    url: "http://localhost:4000",
    requests: 1000,
    concurrent: 10,
    pattern: "ramp",
    delay: 100,
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    const value = args[i + 1];

    switch (key) {
      case "url":
        options.url = value ?? options.url;
        break;
      case "requests":
        options.requests = parseInt(value ?? "1000", 10);
        break;
      case "concurrent":
        options.concurrent = parseInt(value ?? "10", 10);
        break;
      case "pattern":
        options.pattern = (value as "ramp" | "spike" | "steady") ?? "ramp";
        break;
    }
  }

  return options;
}

async function fetchEndpoint(url: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(10_000, () => controller.abort());

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return {
      status: response.status,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: 0,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runLoadTest(opts: LoadTestOptions): Promise<void> {
  const endpoints = [
    "/",                           // Homepage
    "/api/health",                 // Health check
    "/api/analytics/query",        // Analytics list
    "/static/logo.png",            // Static asset
  ];

  const results: TestResult[] = [];
  let completed = 0;
  let errors = 0;

  console.log(`Starting load test: ${opts.requests} requests to ${opts.url}`);
  console.log(`Pattern: ${opts.pattern}, Concurrent: ${opts.concurrent}`);

  const batches = Math.ceil(opts.requests / opts.concurrent);

  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(opts.concurrent, opts.requests - completed);
    const currentConcurrent =
      opts.pattern === "ramp"
        ? Math.max(1, Math.floor((batch + 1) * opts.concurrent / batches))
        : opts.concurrent;

    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      const endpoint = endpoints[(completed + i) % endpoints.length];
      promises.push(fetchEndpoint(`${opts.url}${endpoint}`));
    }

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    completed += batchSize;

    // Progress indicator
    const progress = Math.floor((completed / opts.requests) * 100);
    const rps = (completed / ((Date.now() - (global as any).startTime) / 1000)).toFixed(1);
    console.log(`Progress: ${progress}% (${completed}/${opts.requests}) - ${rps} req/s`);

    // Rate limit to avoid overwhelming
    if (opts.pattern === "spike") {
      // No delay for spike pattern
    } else if (opts.pattern === "ramp") {
      await setTimeout(opts.delay / (1 + batch / batches));
    } else {
      await setTimeout(opts.delay);
    }

    // Track errors
    for (const r of batchResults) {
      if (r.error || r.status >= 400) {
        errors++;
      }
    }
  }

  // Summary
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];

  console.log("\n=== Load Test Results ===");
  console.log(`Total requests: ${opts.requests}`);
  console.log(`Errors: ${errors} (${((errors / opts.requests) * 100).toFixed(1)}%)`);
  console.log(`Avg duration: ${avgDuration.toFixed(1)}ms`);
  console.log(`P50 duration: ${p50}ms`);
  console.log(`P95 duration: ${p95}ms`);
  console.log(`P99 duration: ${p99}ms`);

  // Performance thresholds based on Cloudflare Free Tier expectations
  if (p95 > 5000) {
    console.log("\n⚠️ WARNING: P95 response time exceeds 5s - check D1 performance");
  }
  if (errors > opts.requests * 0.05) {
    console.log("\n⚠️ WARNING: Error rate exceeds 5%");
  }
}

// Run
(global as any).startTime = Date.now();
const opts = parseArgs();
runLoadTest(opts).catch(console.error);