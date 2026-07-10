// Unified Edge Runtime Controller
// Migrates AWS SSM, Lambda, S3, Athena, and Cognito to Cloudflare Free Tier
//
// Layer 1: D1 Auth replaces Cognito (email/password)
// Layer 2: R2 Storage replaces S3
// Layer 3: DuckDB-Wasm endpoint for analytics (client queries parquet)

const SESSION_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days
const RESET_TOKEN_EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

async function hashPassword(password, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hash = new Uint8Array(hashBuffer);
  const hex = [];
  for (let i = 0; i < hash.length; i++) {
    hex.push(("00" + hash[i].toString(16)).slice(-2));
  }
  return hex.join("");
}

function corsHeaders(origin) {
  const allowedOrigins = [
    "https://cloudless.gr",
    "https://staging.cloudless.gr",
    "https://www.cloudless.gr",
    "http://localhost:4000",
    "http://localhost:8787",
  ];
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
    "Access-Control-Allow-Credentials": "true",
  };
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const host = url.hostname;

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(request.headers.get("Origin") || ""),
      });
    }

    // ==========================================
    // WWW REDIRECT - canonical domain handling
    // Redirect www.cloudless.gr to cloudless.gr
    // ==========================================
    if (host === "www.cloudless.gr") {
      const canonicalUrl = url.origin.replace("www.cloudless.gr", "cloudless.gr") + url.pathname + url.search;
      return new Response(null, {
        status: 301,
        headers: {
          Location: canonicalUrl,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // ==========================================
    // LAYER 1: D1 AUTHENTICATION (EDGE)
    // ==========================================

    // POST /api/auth/register - D1 user registration
    if (url.pathname === "/api/auth/register" && method === "POST") {
      const { email, password, name } = await request.json();

      if (!email || !password) {
        return jsonResponse({ error: "Email and password required" }, 400);
      }

      const SESSION_SECRET = env.SESSION_SECRET || "";
      if (!SESSION_SECRET) {
        return jsonResponse({ error: "Authentication not configured" }, 503);
      }

      const { results: existing } = await env.AUTH_DB.prepare(
        "SELECT id FROM user WHERE email = ?",
      ).bind(email.toLowerCase().trim()).all();

      if (existing.length > 0) {
        return jsonResponse({ error: "User already exists" }, 400);
      }

      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(password, SESSION_SECRET);
      const now = Math.floor(Date.now() / 1000);

      await env.AUTH_DB.prepare(
        "INSERT INTO user (id, email, name, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).bind(id, email.toLowerCase().trim(), name || null, email.toLowerCase().trim(), passwordHash, now, now).run();

      await env.AUTH_DB.prepare(
        "INSERT INTO user_role (user_id, role) VALUES (?, ?)",
      ).bind(id, "user").run();

      return jsonResponse({
        ok: true,
        user: { id, email, name: name || null },
      });
    }

    // POST /api/auth/login - Email/password authentication
    if (url.pathname === "/api/auth/login" && method === "POST") {
      const { email, password } = await request.json();

      if (!email || !password) {
        return jsonResponse({ error: "Email and password required" }, 400);
      }

      const SESSION_SECRET = env.SESSION_SECRET || "";
      if (!SESSION_SECRET) {
        return jsonResponse({ error: "Authentication not configured" }, 503);
      }

      const { results } = await env.AUTH_DB.prepare(
        "SELECT * FROM user WHERE email = ?",
      ).bind(email.toLowerCase().trim()).all();

      const user = results[0];
      if (!user) {
        return jsonResponse({ error: "Invalid credentials" }, 401);
      }

      const passwordHash = await hashPassword(password, SESSION_SECRET);
      if (passwordHash !== user.password_hash) {
        return jsonResponse({ error: "Invalid credentials" }, 401);
      }

      const { results: roleResults } = await env.AUTH_DB.prepare(
        "SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'",
      ).bind(user.id).all();
      const isAdmin = roleResults.length > 0;

      const sessionId = crypto.randomUUID();
      const expiresAt = Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS;

      await env.AUTH_DB.prepare(
        "INSERT INTO session (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      ).bind(sessionId, user.id, expiresAt, Math.floor(Date.now() / 1000)).run();

      return new Response(JSON.stringify({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          company: user.company,
          phone: user.phone,
        },
        isAdmin,
      }), {
        headers: {
          "Set-Cookie": `session_token=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_EXPIRY_SECONDS}`,
          "Content-Type": "application/json",
        },
      });
    }

    // POST /api/auth/logout - Destroy session
    if (url.pathname === "/api/auth/logout" && method === "POST") {
      const sessionId = request.headers.get("Cookie")?.match(/session_token=([^;]+)/)?.[1];

      if (sessionId) {
        await env.AUTH_DB.prepare("DELETE FROM session WHERE id = ?").bind(sessionId).run();
      }

      const response = jsonResponse({ ok: true });
      response.headers.append(
        "Set-Cookie",
        "session_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
      );
      return response;
    }

    // POST /api/auth/reset-password - Request password reset
    if (url.pathname === "/api/auth/reset-password" && method === "POST") {
      const { email } = await request.json();

      if (!email) {
        return jsonResponse({ error: "Email required" }, 400);
      }

      const { results } = await env.AUTH_DB.prepare(
        "SELECT id, preferences_json FROM user WHERE email = ?",
      ).bind(email.toLowerCase().trim()).all();

      if (results.length === 0) {
        return jsonResponse({ ok: true });
      }

      const user = results[0];
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const token = btoa(String.fromCharCode(...Array.from(bytes)));
      const expiresAt = Math.floor(Date.now() / 1000) + RESET_TOKEN_EXPIRY_SECONDS;

      await env.AUTH_DB.prepare(
        "UPDATE user SET preferences_json = json_set(COALESCE(preferences_json, '{}'), '$.reset_token', ?, '$.reset_expires', ?) WHERE id = ?",
      ).bind(token, expiresAt, user.id).run();

      const resetUrl = `${url.origin}/auth/reset-confirm?token=${encodeURIComponent(token)}`;

      try {
        if (env.EMAIL) {
          await env.EMAIL.send({
            to: email,
            from: { email: "noreply@cloudless.gr", name: "Cloudless" },
            subject: "Reset your Cloudless password",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #00fff5;">Reset your password</h2>
                <p>Click the link below to set a new password:</p>
                <p><a href="${resetUrl}" style="color: #00fff5;">${resetUrl}</a></p>
                <p style="color: #888; font-size: 12px;">Link expires in 24 hours.</p>
              </div>
            `,
            text: `Reset your password: ${resetUrl}\nLink expires in 24 hours.`,
          });
        }
      } catch {
        // Ignore email errors
      }

      return jsonResponse({ ok: true });
    }

    // POST /api/auth/reset-confirm - Confirm password reset
    if (url.pathname === "/api/auth/reset-confirm" && method === "POST") {
      const { token, newPassword, confirmPassword } = await request.json();

      if (!token || !newPassword || !confirmPassword) {
        return jsonResponse({ error: "Token and passwords required" }, 400);
      }

      if (newPassword !== confirmPassword) {
        return jsonResponse({ error: "Passwords do not match" }, 400);
      }

      if (newPassword.length < 8) {
        return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
      }

      const now = Math.floor(Date.now() / 1000);
      const { results } = await env.AUTH_DB.prepare(
        "SELECT id, preferences_json FROM user WHERE json_extract(preferences_json, '$.reset_token') = ? AND json_extract(preferences_json, '$.reset_expires') > ?",
      ).bind(token, now).all();

      if (results.length === 0) {
        return jsonResponse({ error: "Invalid or expired reset token" }, 400);
      }

      const user = results[0];
      const SESSION_SECRET = env.SESSION_SECRET || "";
      const passwordHash = await hashPassword(newPassword, SESSION_SECRET);

      const prefs = JSON.parse(user.preferences_json || "{}");
      delete prefs.reset_token;
      delete prefs.reset_expires;

      await env.AUTH_DB.prepare(
        "UPDATE user SET password_hash = ?, preferences_json = ? WHERE id = ?",
      ).bind(passwordHash, JSON.stringify(prefs), user.id).run();

      await env.AUTH_DB.prepare("DELETE FROM session WHERE user_id = ?").bind(user.id).run();

      return jsonResponse({ ok: true });
    }

    // GET /api/auth/session - Validate session cookie
    if (url.pathname === "/api/auth/session" && method === "GET") {
      const sessionId = request.headers.get("Cookie")?.match(/session_token=([^;]+)/)?.[1];

      if (!sessionId) {
        return jsonResponse({ user: null });
      }

      const now = Math.floor(Date.now() / 1000);
      const { results: sessionResults } = await env.AUTH_DB.prepare(
        "SELECT * FROM session WHERE id = ? AND expires_at > ?",
      ).bind(sessionId, now).all();

      if (sessionResults.length === 0) {
        const response = jsonResponse({ user: null });
        response.headers.append("Set-Cookie", "session_token=; Path=/; HttpOnly; Max-Age=0");
        return response;
      }

      const session = sessionResults[0];
      const { results: userResults } = await env.AUTH_DB.prepare(
        "SELECT id, email, name, company, phone, preferences_json, created_at, updated_at FROM user WHERE id = ?",
      ).bind(session.user_id).all();

      if (userResults.length === 0) {
        return jsonResponse({ user: null });
      }

      const user = userResults[0];
      const { results: roleResults } = await env.AUTH_DB.prepare(
        "SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'",
      ).bind(user.id).all();

      return jsonResponse({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          company: user.company,
          phone: user.phone,
          preferences: user.preferences_json ? JSON.parse(user.preferences_json) : {},
        },
        isAdmin: roleResults.length > 0,
      });
    }

    // ==========================================
    // LAYER 2: R2 STORAGE (STATIC ASSETS)
    // ==========================================
    if (url.pathname.startsWith("/static/") || url.pathname === "/assets/") {
      const assetPath = url.pathname.replace(/^\/static/, "").replace(/^\/assets/, "");
      const asset = await env.ASSETS_BUCKET.get(assetPath);

      if (!asset) {
        return new Response("Not found", { status: 404 });
      }

      const headers = new Headers();
      asset.writeHttpMetadata(headers);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(asset.body, { headers });
    }

    // ==========================================
    // LAYER 3: ANALYTICS ENDPOINT (DUCKDB-WASM)
    // ==========================================

    // GET /api/analytics/r2 - Serve parquet files for DuckDB-Wasm
    if (url.pathname === "/api/analytics/r2" && method === "GET") {
      const file = url.searchParams.get("file");

      if (!file) {
        return new Response("Missing file parameter", { status: 400 });
      }

      if (!/^[a-zA-Z0-9_\-./]+\.parquet$/.test(file)) {
        return new Response("Invalid filename", { status: 400 });
      }

      const rangeHeader = request.headers.get("range");
      const options = {};

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : undefined;
          if (end) {
            options.range = { offset: start, length: end - start + 1 };
          } else {
            options.range = { offset: start, length: 1024 * 1024 };
          }
        }
      }

      const object = await env.ANALYTICS_BUCKET.get(`lake/${file}`, options);

      if (!object) {
        return new Response("Not found", { status: 404 });
      }

      const headers = new Headers();
      headers.set("Content-Type", "application/octet-stream");
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Accept-Ranges", "bytes");
      headers.set("Cache-Control", "public, max-age=3600");

      if (object.httpEtag) {
        headers.set("ETag", object.httpEtag);
      }

      return new Response(object.body, { headers });
    }

    // GET /api/analytics/query
    if (url.pathname === "/api/analytics/query" && method === "GET") {
      const prefix = url.searchParams.get("prefix") || "";

      const objects = await env.ANALYTICS_BUCKET.list({
        prefix: `lake/${prefix}`,
        limit: 100,
      });

      const files = objects.objects
        .filter((obj) => obj.key.endsWith(".parquet"))
        .map((obj) => ({
          key: obj.key.replace("lake/", ""),
          size: obj.size,
          uploaded: obj.uploaded,
        }));

      return jsonResponse({
        ok: true,
        files,
        total: files.length,
        truncated: objects.truncated,
      });
    }

    // ==========================================
    // ADMIN: Promote user to admin
    // ==========================================
    if (url.pathname === "/api/admin/users/promote" && method === "POST") {
      const { email } = await request.json();

      if (!email) {
        return jsonResponse({ error: "Email required" }, 400);
      }

      const { results } = await env.AUTH_DB.prepare(
        "SELECT id FROM user WHERE email = ?",
      ).bind(email.toLowerCase().trim()).all();

      if (results.length === 0) {
        return jsonResponse({ error: "User not found" }, 404);
      }

      const user = results[0];
      await env.AUTH_DB.prepare(
        "INSERT OR REPLACE INTO user_role (user_id, role) VALUES (?, ?)",
      ).bind(user.id, "admin").run();

      return jsonResponse({ ok: true, message: `User ${email} promoted to admin` });
    }

    // ==========================================
    // HEALTH CHECK
    // ==========================================
    if (url.pathname === "/api/health" && method === "GET") {
      let dbOk = false;
      try {
        const { results } = await env.AUTH_DB.prepare("SELECT 1 as ok").all();
        dbOk = results.length > 0 && results[0].ok === 1;
      } catch {
        dbOk = false;
      }

      return jsonResponse({
        status: dbOk ? "ok" : "degraded",
        version: "1.0.0",
        authProvider: "d1",
        dbConnected: dbOk,
        timestamp: new Date().toISOString(),
      });
    }

    // ==========================================
    // FALLBACK: Serve index.html for SPA routes
    // ==========================================
    // For any unknown route on cloudless.gr, serve the index.html (SPA fallback)
    // The ASSETS_BUCKET contains pre-built static files from the Next.js build
    if (host === "cloudless.gr" || host.endsWith(".cloudless.gr")) {
      // Try to serve static file from R2
      const assetPath = url.pathname === "/" ? "/index.html" : url.pathname;
      const asset = await env.ASSETS_BUCKET.get(assetPath);

      if (asset) {
        const headers = new Headers();
        asset.writeHttpMetadata(headers);
        headers.set("Cache-Control", "public, max-age=3600");
        headers.set("Access-Control-Allow-Origin", "https://cloudless.gr");
        return new Response(asset.body, { headers });
      }

      // For SPA routes, serve index.html (client-side routing)
      const indexAsset = await env.ASSETS_BUCKET.get("index.html");
      if (indexAsset) {
        return new Response(indexAsset.body, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};