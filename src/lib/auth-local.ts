/**
 * Local Auth - Email/Password Authentication without AWS
 * 
 * Uses Cloudflare D1 for user storage. Utility functions for auth.ts.
 * Designed for k3s deployments on Cloudflare.
 */

import { D1Database } from "@cloudflare/workers-types";

// User interface for D1 storage
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  company?: string;
  phone?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
/**
 * Hash password using Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify password matches hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Create user in D1 database
 */
export async function createUser(
  db: D1Database,
  email: string,
  password: string,
  name?: string
): Promise<{ user: User; error?: string }> {
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  try {
    const stmt = db.prepare(
      "INSERT INTO users (id, email, passwordHash, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
    );
    await stmt.bind(userId, email.toLowerCase(), passwordHash, name, now, now).run();

    return {
      user: {
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        name,
        emailVerified: false,
        createdAt: now,
        updatedAt: now
      }
    };
  } catch (error) {
    console.error("[local-auth] createUser error:", error);
    return { user: {} as User, error: "Failed to create user" };
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(
  db: D1Database,
  email: string
): Promise<User | null> {
  try {
    const stmt = db.prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
    const user = await stmt.bind(email.toLowerCase()).first<User>();
    return user;
  } catch (error) {
    console.error("[local-auth] getUserByEmail error:", error);
    return null;
  }
}

/**
 * Create session for user
 */
export async function createSession(
  db: D1Database,
  userId: string
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  try {
    const stmt = db.prepare(
      "INSERT INTO sessions (id, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)"
    );
    await stmt.bind(sessionId, userId, expiresAt, now.toISOString()).run();
    return sessionId;
  } catch (error) {
    console.error("[local-auth] createSession error:", error);
    throw new Error("Failed to create session");
  }
}

/**
 * Get user by session token
 */
export async function getUserBySession(
  db: D1Database,
  sessionId: string
): Promise<User | null> {
  try {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      "SELECT u.* FROM users u JOIN sessions s ON u.id = s.userId WHERE s.id = ? AND s.expiresAt > ? LIMIT 1"
    );
    const user = await stmt.bind(sessionId, now).first<User>();
    return user;
  } catch (error) {
    console.error("[local-auth] getUserBySession error:", error);
    return null;
  }
}

/**
 * Delete session
 */
export async function deleteSession(
  db: D1Database,
  sessionId: string
): Promise<void> {
  try {
    const stmt = db.prepare("DELETE FROM sessions WHERE id = ?");
    await stmt.bind(sessionId).run();
  } catch (error) {
    console.error("[local-auth] deleteSession error:", error);
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin(
  db: D1Database,
  userId: string
): Promise<boolean> {
  try {
    const stmt = db.prepare("SELECT isAdmin FROM users WHERE id = ? LIMIT 1");
    const result = await stmt.bind(userId).first<{ isAdmin: boolean }>();
    return result?.isAdmin ?? false;
  } catch (error) {
    console.error("[local-auth] isAdmin error:", error);
    return false;
  }
}
