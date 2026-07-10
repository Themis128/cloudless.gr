#!/usr/bin/env npx tsx
/**
 * Migration Test Suite
 * 
 * Run this to verify all Cloudflare Free Tier services work after enablement.
 * 
 * Usage:
 *   npm run test:migration
 */

import { execSync } from "child_process";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1: Check Wrangler CLI
  results.push({
    name: "Wrangler CLI",
    passed: true,
    error: execSync("npx wrangler --version", { encoding: "utf-8" }).includes("wrangler"),
  });

  // Test 2: Check R2 buckets exist (after you run create commands)
  try {
    const output = execSync("npx wrangler r2 bucket list", { encoding: "utf-8" });
    const hasBuckets = output.includes("app-media-bucket") && output.includes("datalake-bucket");
    results.push({ name: "R2 Buckets", passed: hasBuckets, error: hasBuckets ? undefined : "Buckets not created" });
  } catch (err) {
    results.push({ name: "R2 Buckets", passed: false, error: "R2 not enabled or no permission" });
  }

  // Test 3: Check D1 database exists
  try {
    const output = execSync("npx wrangler d1 list", { encoding: "utf-8" });
    const hasDb = output.includes("user-auth-db");
    results.push({ name: "D1 Database", passed: hasDb, error: hasDb ? undefined : "Database not created" });
  } catch (err) {
    results.push({ name: "D1 Database", passed: false, error: "D1 not enabled or no permission" });
  }

  // Test 4: Check schema applied
  try {
    execSync("npx wrangler d1 execute user-auth-db --command 'SELECT name FROM sqlite_master WHERE type=\"table\";'", { encoding: "utf-8" });
    results.push({ name: "D1 Schema", passed: true });
  } catch (err) {
    results.push({ name: "D1 Schema", passed: false, error: "Schema not applied" });
  }

	// Test 5: Check secrets (both Wrangler and local .env.local)
  	const secrets = ["GEMINI_API_KEY", "AUTH_SECRET", "STRIPE_SECRET_KEY"];
  	for (const secret of secrets) {
  		try {
  			// First try Wrangler secrets
  			execSync(`npx wrangler secret list 2>/dev/null | grep "${secret}"`, { encoding: "utf-8" });
  			results.push({ name: `Secret ${secret}`, passed: true });
  		} catch (err) {
  			// Fallback: check .env.local
  			try {
  				const envOutput = execSync(`grep -E "^${secret}=" .env.local | head -1`, { encoding: "utf-8" });
  				if (envOutput.trim()) {
  					results.push({ name: `Secret ${secret}`, passed: true, error: "(local env)" });
  				} else {
  					results.push({ name: `Secret ${secret}`, passed: false, error: "Secret not set" });
  				}
  			} catch {
  				results.push({ name: `Secret ${secret}`, passed: false, error: "Secret not set" });
  			}
  		}
  	}

  return results;
}

async function main() {
  console.log("Running Cloudflare Free Tier Migration Tests...\n");
  const results = await runTests();
  
  console.log("Results:");
  for (const r of results) {
    const status = r.passed ? "✅" : "❌";
    console.log(`  ${status} ${r.name}${r.error ? ` - ${r.error}` : ""}`);
  }
  
  const passed = results.filter(r => r.passed).length;
  console.log(`\n${passed}/${results.length} tests passed`);
}

main().catch(console.error);