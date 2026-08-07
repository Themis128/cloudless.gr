#!/usr/bin/env node

import { getAuthDbFromEnv } from "../src/lib/auth-d1";
import { checkFailedAttempts } from "../src/lib/auth-d1";

async function main() {
  console.log("Checking lockout status...");
  
  const db = getAuthDbFromEnv();
  if (!db) {
    console.error("Failed to get database connection");
    process.exit(1);
  }
  
  const email = "tbaltzakis@cloudless.gr";
  
  try {
    const lockoutStatus = await checkFailedAttempts(db, email);
    console.log("Lockout status:", JSON.stringify(lockoutStatus, null, 2));
  } catch (err) {
    console.error("Error checking lockout status:", err);
  }
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});