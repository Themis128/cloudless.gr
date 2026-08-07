#!/usr/bin/env node

import { getAuthDbFromEnv } from "../src/lib/auth-d1";
import { createUser, createAdminUser } from "../src/lib/auth-d1";

async function main() {
  console.log("Creating admin user...");
  
  const db = getAuthDbFromEnv();
  if (!db) {
    console.error("Failed to get database connection");
    process.exit(1);
  }
  
  const email = "tbaltzakis@cloudless.gr";
  const password = "TH!123789th!";
  const name = "Themis Baltzakis";
  
  // Check if user already exists
  const existing = await db.prepare("SELECT id FROM user WHERE email = ?").bind(email).first<{ id: string }>();
  if (existing) {
    console.log("User already exists, making them admin...");
    const result = await createAdminUser(db, email);
    if (result.success) {
      console.log("Successfully made user admin");
    } else {
      console.error("Failed to make user admin:", result.error);
      process.exit(1);
    }
  } else {
    console.log("Creating new user...");
    const createResult = await createUser(db, email, password, name);
    if (createResult.error) {
      console.error("Failed to create user:", createResult.error);
      process.exit(1);
    }
    
    console.log("User created successfully, making them admin...");
    const adminResult = await createAdminUser(db, email);
    if (adminResult.success) {
      console.log("Successfully made user admin");
    } else {
      console.error("Failed to make user admin:", adminResult.error);
      process.exit(1);
    }
  }
  
  console.log("Admin user setup complete!");
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});