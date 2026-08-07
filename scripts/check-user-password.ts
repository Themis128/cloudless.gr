#!/usr/bin/env node

import { getAuthDbFromEnv } from "../src/lib/auth-d1";
import { verifyPassword } from "../src/lib/auth-d1";

async function main() {
  console.log("Checking user password...");
  
  const db = getAuthDbFromEnv();
  if (!db) {
    console.error("Failed to get database connection");
    process.exit(1);
  }
  
  const email = "tbaltzakis@cloudless.gr";
  const password = "TH!123789th!";
  
  try {
    // Get the user
    const userResult = await db.prepare("SELECT id, email, password_hash FROM user WHERE email = ?").bind(email).first();
    console.log("User found:", JSON.stringify(userResult, null, 2));
    
    if (userResult && userResult.password_hash) {
      // Check if the password matches
      const isValid = await verifyPassword(password, userResult.password_hash);
      console.log(`Password validation result: ${isValid}`);
      
      if (!isValid) {
        console.log("Password does not match. Updating password...");
        // Update the password
        const { hashPassword } = await import("../src/lib/auth-d1");
        const newPasswordHash = await hashPassword(password);
        
        const updateResult = await db.prepare("UPDATE user SET password_hash = ? WHERE email = ?").bind(newPasswordHash, email).run();
        console.log("Password update result:", JSON.stringify(updateResult, null, 2));
        
        // Verify again
        const isValidAfterUpdate = await verifyPassword(password, newPasswordHash);
        console.log(`Password validation after update: ${isValidAfterUpdate}`);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});