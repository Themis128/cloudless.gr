/**
 * D1-based authentication layer for Cloudflare Free Tier migration.
 *
 * Replaces AWS Cognito + DynamoDB SessionTokenStore with:
 * - D1 database for user storage and sessions
 * - PBKDF2/scrypt password hashing (secure, available in Workers)
 * - Custom password reset flow
 * - JWT-like session tokens (stored server-side, referenced by cookie)
 */

// Token expiry constants
const SESSION_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days (default)
const SESSION_EXPIRY_REMEMBER_SECONDS = 60 * 60 * 24 * 60; // 60 days (remember me)
const RESET_TOKEN_EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

// Secret key for session tokens - must be set via Wrangler secret
const SESSION_SECRET = process.env.SESSION_SECRET || "";

// D1 binding interface (provided by Worker)
export interface AuthDatabase {
  prepare: (query: string) => D1PreparedStatement;
}

interface D1PreparedStatement {
  bind: (...args: unknown[]) => D1PreparedStatement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[]; success: boolean }>;
  run: () => Promise<{ success: boolean; meta?: { changes: number } }>;
  first: <T = Record<string, unknown>>(col?: string) => Promise<T | null>;
}

// Type definitions
export interface D1User {
  id: string;
  email: string;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  password_hash: string;
  preferences_json?: string | null;
  created_at: number;
  updated_at: number;
}

export interface D1Session {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
}

export interface AuthResult {
  user?: D1User;
  session?: D1Session;
  error?: string;
}

// Hex encoding helper
function encodeHex(uint8: Uint8Array): string {
  const hex: string[] = [];
  for (let i = 0; i < uint8.length; i++) {
    hex.push(("00" + uint8[i].toString(16)).slice(-2));
  }
  return hex.join("");
}

// Base64 encoding helper
function encodeBase64(uint8: Uint8Array): string {
  const binary = Array.from(uint8, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary);
}

// Crypto utilities (Web Crypto API available in Workers)
// Using PBKDF2 for secure password hashing (available in Workers runtime)

// Generate a random salt for password hashing
function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeBase64(bytes);
}

// PBKDF2-based password hashing with salt
async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const encoder = new TextEncoder();
  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password + SESSION_SECRET),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return `${salt}:${encodeHex(new Uint8Array(derivedBits))}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    // Legacy SHA-256 hash support (backward compatibility)
    const encoder = new TextEncoder();
    const data = encoder.encode(password + SESSION_SECRET);
    const legacyHash = await crypto.subtle.digest("SHA-256", data);
    const computed = encodeHex(new Uint8Array(legacyHash));
    return computed === storedHash;
  }

  const encoder = new TextEncoder();
  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password + SESSION_SECRET),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return `${salt}:${encodeHex(new Uint8Array(derivedBits))}` === storedHash;
}

// Password strength validation
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character" };
  }
  return { valid: true };
}

// Session activity logging
export async function logSessionActivity(
  db: AuthDatabase,
  sessionId: string,
  action: "login" | "logout" | "lockout" | "failed_attempt",
  email?: string,
  ip?: string,
  userAgent?: string
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO session_log (session_id, action, email, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(
      sessionId,
      action,
      email || null,
      ip || null,
      userAgent || null,
      Math.floor(Date.now() / 1000)
    )
    .run();
}

// Check failed attempts for account lockout
export async function checkFailedAttempts(
  db: AuthDatabase,
  email: string
): Promise<{ locked: boolean; attempts: number }> {
  const threshold = 5;
  const windowSeconds = 15 * 60; // 15 minutes
  const now = Math.floor(Date.now() / 1000);

  const attempts = await db
    .prepare(
      "SELECT COUNT(*) as count FROM session_log WHERE action = 'failed_attempt' AND email = ? AND created_at > ?"
    )
    .bind(email, now - windowSeconds)
    .first<{ count: number }>();

  return { locked: (attempts?.count ?? 0) >= threshold, attempts: attempts?.count ?? 0 };
}

function generateResetToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64(bytes);
}

// Database operations
export async function createUser(
  db: AuthDatabase,
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  // Check if user exists
  const existing = await db
    .prepare("SELECT id FROM user WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();

  if (existing) {
    return { error: "User already exists" };
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = Math.floor(Date.now() / 1000);

  try {
    await db
      .prepare(
        "INSERT INTO user (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(id, email, name || null, passwordHash, now, now)
      .run();

    // Default to 'user' role
    await db.prepare("INSERT INTO user_role (user_id, role) VALUES (?, ?)").bind(id, "user").run();

    return {
      user: { id, email, name, password_hash: passwordHash, created_at: now, updated_at: now },
    };
  } catch {
    return { error: "Failed to create user" };
  }
}

export async function authenticateUser(
  db: AuthDatabase,
  email: string,
  password: string,
  rememberMe?: boolean
): Promise<AuthResult> {
  // Check if SESSION_SECRET is configured
  if (!SESSION_SECRET) {
    return { error: "Authentication not configured" };
  }

  // Validate SESSION_SECRET length (32+ bytes)
  if (SESSION_SECRET.length < 32) {
    console.warn("[auth] SESSION_SECRET should be at least 32 characters for security");
  }

  const user = await db.prepare("SELECT * FROM user WHERE email = ?").bind(email).first<D1User>();

  if (!user) {
    return { error: "Invalid credentials" };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return { error: "Invalid credentials" };
  }

  // Create session with appropriate expiry
  const sessionId = crypto.randomUUID();
  const expirySeconds = rememberMe
    ? SESSION_EXPIRY_REMEMBER_SECONDS
    : SESSION_EXPIRY_SECONDS;
  const expiresAt = Math.floor(Date.now() / 1000) + expirySeconds;

  await db
    .prepare("INSERT INTO session (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(sessionId, user.id, expiresAt, Math.floor(Date.now() / 1000))
    .run();

  return {
    user,
    session: {
      id: sessionId,
      user_id: user.id,
      expires_at: expiresAt,
      created_at: Math.floor(Date.now() / 1000),
    },
  };
}

export async function getUserBySession(
  db: AuthDatabase,
  sessionId: string
): Promise<D1User | null> {
  const now = Math.floor(Date.now() / 1000);

  const session = await db
    .prepare("SELECT * FROM session WHERE id = ? AND expires_at > ?")
    .bind(sessionId, now)
    .first<D1Session>();

  if (!session) {
    return null;
  }

  const user = await db
    .prepare(
      "SELECT id, email, name, company, phone, preferences_json, created_at, updated_at FROM user WHERE id = ?"
    )
    .bind(session.user_id)
    .first<D1User>();

  return user;
}

export async function deleteSession(db: AuthDatabase, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM session WHERE id = ?").bind(sessionId).run();
}

export async function updateUser(
  db: AuthDatabase,
  userId: string,
  attrs: { name?: string; company?: string; phone?: string; preferences?: Record<string, unknown> }
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const { name, company, phone, preferences } = attrs;

  await db
    .prepare(
      "UPDATE user SET name = ?, company = ?, phone = ?, preferences_json = ?, updated_at = ? WHERE id = ?"
    )
    .bind(
      name || null,
      company || null,
      phone || null,
      preferences ? JSON.stringify(preferences) : null,
      now,
      userId
    )
    .run();
}

export async function isAdmin(db: AuthDatabase, userId: string): Promise<boolean> {
  const role = await db
    .prepare("SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'")
    .bind(userId)
    .first<{ role: string }>();

  return !!role;
}

export async function createAdminUser(
  db: AuthDatabase,
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!SESSION_SECRET) {
    return { success: false, error: "Authentication not configured" };
  }

  const user = await db
    .prepare("SELECT id FROM user WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();

  if (!user) {
    return { success: false, error: "User not found" };
  }

  await db
    .prepare("INSERT OR REPLACE INTO user_role (user_id, role) VALUES (?, ?)")
    .bind(user.id, "admin")
    .run();

  return { success: true };
}

// Password reset flow
export async function createPasswordResetToken(
  db: AuthDatabase,
  email: string
): Promise<{ token?: string; error?: string }> {
  if (!SESSION_SECRET) {
    return { error: "Authentication not configured" };
  }

  const user = await db
    .prepare("SELECT id FROM user WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();

  if (!user) {
    // Don't reveal if user exists - return success anyway
    return { token: undefined };
  }

  const token = generateResetToken();
  const expiresAt = Math.floor(Date.now() / 1000) + RESET_TOKEN_EXPIRY_SECONDS;

  // Store reset token in user table (overwriting previous)
  await db
    .prepare(
      "UPDATE user SET preferences_json = json_set(COALESCE(preferences_json, '{}'), '$.reset_token', ?, '$.reset_expires', ?)"
    )
    .bind(token, expiresAt)
    .run();

  return { token };
}

export async function consumePasswordResetToken(
  db: AuthDatabase,
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!SESSION_SECRET) {
    return { success: false, error: "Authentication not configured" };
  }

  const now = Math.floor(Date.now() / 1000);

  // Find user with valid reset token
  const users = await db
    .prepare(
      "SELECT id, preferences_json FROM user WHERE json_extract(preferences_json, '$.reset_token') = ? AND json_extract(preferences_json, '$.reset_expires') > ?"
    )
    .bind(token, now)
    .all<{ id: string; preferences_json: string }>();

  if (!users.results.length) {
    return { success: false, error: "Invalid or expired reset token" };
  }

  const user = users.results[0];
  if (!user) {
    return { success: false, error: "Invalid or expired reset token" };
  }

  const passwordHash = await hashPassword(newPassword);

  // Update password and clear reset token
  const prefs = JSON.parse(user.preferences_json || "{}");
  delete prefs.reset_token;
  delete prefs.reset_expires;

  await db
    .prepare("UPDATE user SET password_hash = ?, preferences_json = ? WHERE id = ?")
    .bind(passwordHash, JSON.stringify(prefs), user.id)
    .run();

  // Invalidate all sessions for this user
  await db.prepare("DELETE FROM session WHERE user_id = ?").bind(user.id).run();

  return { success: true };
}

// Session cleanup (for maintenance cron)
export async function cleanupExpiredSessions(db: AuthDatabase): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.prepare("DELETE FROM session WHERE expires_at < ?").bind(now).run();
  return result.meta?.changes ?? 0;
}

// Session secret validation
export function validateSessionSecret(): { valid: boolean; error?: string } {
  if (!SESSION_SECRET) {
    return { valid: false, error: "SESSION_SECRET is not set" };
  }
  if (SESSION_SECRET.length < 32) {
    return { valid: false, error: "SESSION_SECRET must be at least 32 characters" };
  }
  return { valid: true };
}