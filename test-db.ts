import { getAuthDbFromEnv } from "./src/lib/auth-d1";

async function test() {
  const db = getAuthDbFromEnv();
  if (!db) {
    console.error("Failed to get database connection");
    process.exit(1);
  }

  console.log("Database connection obtained");

  // Check if the user table exists
  try {
    const result = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user'")
      .all();
    console.log("User table exists:", result.results.length > 0);
  } catch (e) {
    console.error("Error checking user table:", e);
  }

  // Check if the user_role table exists
  try {
    const result = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_role'")
      .all();
    console.log("User role table exists:", result.results.length > 0);
  } catch (e) {
    console.error("Error checking user_role table:", e);
  }

  // Try to insert a test user (and then delete it) to see if write works
  try {
    const testId = "test-user-id";
    const testEmail = "test@example.com";
    const testPasswordHash = "hash";
    const now = Math.floor(Date.now() / 1000);

    // Insert
    await db
      .prepare(
        "INSERT INTO user (id, username, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(testId, testEmail, testEmail, "Test User", testPasswordHash, now, now)
      .run();

    console.log("Insert test user successful");

    // Clean up
    await db.prepare("DELETE FROM user WHERE id = ?").bind(testId).run();
    console.log("Cleaned up test user");
  } catch (e) {
    console.error("Error inserting test user:", e);
  }
}

test().catch(console.error);