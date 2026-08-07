#!/usr/bin/env node

import { getAuthDbFromEnv } from "../src/lib/auth-d1";
import { readPreferenceFlag } from "../src/lib/auth-d1";

async function main() {
  console.log("Checking user preferences...");
  
  const db = getAuthDbFromEnv();
  if (!db) {
    console.error("Failed to get database connection");
    process.exit(1);
  }
  
  const email = "tbaltzakis@cloudless.gr";
  
  try {
    const userResult = await db.prepare("SELECT id, email, preferences_json FROM user WHERE email = ?").bind(email).first();
    console.log("User:", JSON.stringify(userResult, null, 2));
    
    if (userResult) {
      const disabled = readPreferenceFlag(userResult.preferences_json, "disabled");
      const emailVerified = readPreferenceFlag(userResult.preferences_json, "email_verified");
      console.log("Disabled:", disabled);
      console.log("Email verified:", emailVerified);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});