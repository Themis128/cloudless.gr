#!/usr/bin/env node

import { getAuthDbFromEnv } from "../src/lib/auth-d1";

async function main() {
  console.log("Checking existing users...");
  
  const db = getAuthDbFromEnv();
  if (!db) {
    console.error("Failed to get database connection");
    process.exit(1);
  }
  
  try {
    const result = await db.prepare("SELECT id, email, name FROM user").all();
    console.log("Users in database:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error querying users:", err);
  }
  
  try {
    const result = await db.prepare("SELECT user_id, role FROM user_role").all();
    console.log("User roles in database:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error querying user roles:", err);
  }
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});