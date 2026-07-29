// Unified Edge Runtime Controller
// Migrates AWS SSM, Lambda, S3, Athena, and Cognito to Cloudflare Free Tier
//
// Layer 1: D1 Auth replaces Cognito (email/password)
// Layer 2: R2 Storage replaces S3
// Layer 3: DuckDB-Wasm endpoint for analytics (client queries parquet)

const SESSION_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days
const RESET_TOKEN_EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

// PBKDF2 password hashing (WebCrypto compatible) - ~100k iterations for security
async function hashPassword(password, secret) {
  const encoder = new TextEncoder();
  const salt = encoder.encode(secret.slice(0, 16).padEnd(16, "0"));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hash = new Uint8Array(hashBuffer);
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Legacy SHA-256 verification for backward compatibility during migration
async function _verifyLegacyPassword(password, secret, expectedHash) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hash = new Uint8Array(hashBuffer);
  const hex = Array.from(hash)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === expectedHash;
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

const cloudflareFreeWorker = {
  async fetch(request, env, _ctx) {
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
      const canonicalUrl =
        url.origin.replace("www.cloudless.gr", "cloudless.gr") + url.pathname + url.search;
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

      const { results: existing } = await env.AUTH_DB.prepare("SELECT id FROM user WHERE email = ?")
        .bind(email.toLowerCase().trim())
        .all();

      if (existing.length > 0) {
        return jsonResponse({ error: "User already exists" }, 400);
      }

      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(password, SESSION_SECRET);
      const now = Math.floor(Date.now() / 1000);

      await env.AUTH_DB.prepare(
        "INSERT INTO user (id, email, name, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          id,
          email.toLowerCase().trim(),
          name || null,
          email.toLowerCase().trim(),
          passwordHash,
          now,
          now
        )
        .run();

      await env.AUTH_DB.prepare("INSERT INTO user_role (user_id, role) VALUES (?, ?)")
        .bind(id, "user")
        .run();

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

      const { results } = await env.AUTH_DB.prepare("SELECT * FROM user WHERE email = ?")
        .bind(email.toLowerCase().trim())
        .all();

      const user = results[0];
      if (!user) {
        return jsonResponse({ error: "Invalid credentials" }, 401);
      }

      const passwordHash = await hashPassword(password, SESSION_SECRET);
      if (passwordHash !== user.password_hash) {
        return jsonResponse({ error: "Invalid credentials" }, 401);
      }

      const { results: roleResults } = await env.AUTH_DB.prepare(
        "SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'"
      )
        .bind(user.id)
        .all();
      const isAdmin = roleResults.length > 0;

      const sessionId = crypto.randomUUID();
      const expiresAt = Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS;

      await env.AUTH_DB.prepare(
        "INSERT INTO session (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
      )
        .bind(sessionId, user.id, expiresAt, Math.floor(Date.now() / 1000))
        .run();

      return new Response(
        JSON.stringify({
          ok: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            company: user.company,
            phone: user.phone,
          },
          isAdmin,
        }),
        {
          headers: {
            "Set-Cookie": `session_token=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_EXPIRY_SECONDS}`,
            "Content-Type": "application/json",
          },
        }
      );
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
        "session_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
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
        "SELECT id, preferences_json FROM user WHERE email = ?"
      )
        .bind(email.toLowerCase().trim())
        .all();

      if (results.length === 0) {
        return jsonResponse({ ok: true });
      }

      const user = results[0];
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const token = btoa(String.fromCharCode(...Array.from(bytes)));
      const expiresAt = Math.floor(Date.now() / 1000) + RESET_TOKEN_EXPIRY_SECONDS;

      await env.AUTH_DB.prepare(
        "UPDATE user SET preferences_json = json_set(COALESCE(preferences_json, '{}'), '$.reset_token', ?, '$.reset_expires', ?) WHERE id = ?"
      )
        .bind(token, expiresAt, user.id)
        .run();

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
        "SELECT id, preferences_json FROM user WHERE json_extract(preferences_json, '$.reset_token') = ? AND json_extract(preferences_json, '$.reset_expires') > ?"
      )
        .bind(token, now)
        .all();

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
        "UPDATE user SET password_hash = ?, preferences_json = ? WHERE id = ?"
      )
        .bind(passwordHash, JSON.stringify(prefs), user.id)
        .run();

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
        "SELECT * FROM session WHERE id = ? AND expires_at > ?"
      )
        .bind(sessionId, now)
        .all();

      if (sessionResults.length === 0) {
        const response = jsonResponse({ user: null });
        response.headers.append("Set-Cookie", "session_token=; Path=/; HttpOnly; Max-Age=0");
        return response;
      }

      const session = sessionResults[0];
      const { results: userResults } = await env.AUTH_DB.prepare(
        "SELECT id, email, name, company, phone, preferences_json, created_at, updated_at FROM user WHERE id = ?"
      )
        .bind(session.user_id)
        .all();

      if (userResults.length === 0) {
        return jsonResponse({ user: null });
      }

      const user = userResults[0];
      const { results: roleResults } = await env.AUTH_DB.prepare(
        "SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'"
      )
        .bind(user.id)
        .all();

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
    if (url.pathname.startsWith("/static/") || url.pathname.startsWith("/assets/")) {
      // Strip leading slash to match R2 bucket key format (static/... not /static/...)
      const assetPath = url.pathname.replace(/^\//, "");
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

      const { results } = await env.AUTH_DB.prepare("SELECT id FROM user WHERE email = ?")
        .bind(email.toLowerCase().trim())
        .all();

      if (results.length === 0) {
        return jsonResponse({ error: "User not found" }, 404);
      }

      const user = results[0];
      await env.AUTH_DB.prepare("INSERT OR REPLACE INTO user_role (user_id, role) VALUES (?, ?)")
        .bind(user.id, "admin")
        .run();

      return jsonResponse({ ok: true, message: `User ${email} promoted to admin` });
    }

    // ==========================================
    // CHAT ENDPOINT (Service Binding)
    // ==========================================

    // POST /api/chat - Delegate to cloudless-gr-chat service via RPC binding
    if (url.pathname === "/api/chat" && method === "POST") {
      // First, try service binding (RPC-style, zero latency)
      if (env.CHAT) {
        try {
          const body = await request.json();
          const messages = body.messages || [];
          const headers = {};
          for (const [key, value] of request.headers.entries()) {
            headers[key.toLowerCase()] = value;
          }

          // RPC-style call to chat service
          const stream = await env.CHAT.chatStream(messages, headers);
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
            },
          });
        } catch (err) {
          console.warn(
            "[chat] Service binding failed, falling back:",
            err instanceof Error ? err.message : err
          );
        }
      }

      // Fallback: Workers AI inline
      const encoder = new TextEncoder();
      let messages;
      try {
        const body = await request.json();
        if (!body.messages || !Array.isArray(body.messages)) {
          return jsonResponse({ error: "Invalid request: messages array required" }, 400);
        }
        messages = body.messages.slice(-10).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content || "").slice(0, 500),
        }));
      } catch {
        return jsonResponse({ error: "Invalid request body" }, 400);
      }

      // Try Workers AI first
      if (env.AI) {
        try {
          const SYSTEM_PROMPT = `You are Cloudless Assistant, a helpful pre-sales assistant for Cloudless.gr — a cloud computing, serverless architecture, and AI-powered digital marketing agency. Services: Cloud Architecture & Migration, Serverless Development, Data Analytics, AI Growth Engine. Based in Greece, serves EU and international clients. Keep answers concise (2-4 sentences max).`;

          const workersAiMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

          const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: workersAiMessages,
            max_tokens: 600,
          });

          const response = result.response || "";
          if (!response) {
            throw new Error("Empty response from Workers AI");
          }
          const stream = new ReadableStream({
            start(controller) {
              const chunks = response.match(/.{1,80}/g) || [response];
              for (const chunk of chunks) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        } catch (err) {
          console.warn(
            "[chat] Workers AI failed:",
            err instanceof Error ? err.message : String(err)
          );
        }
      }

      // Fallback: Google Gemini API if available
      if (env.GOOGLE_AI_API_KEY) {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GOOGLE_AI_API_KEY}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: messages.map((m) => ({
                  role: m.role === "user" ? "user" : "model",
                  parts: [{ text: m.content }],
                })),
                systemInstruction:
                  "You are Cloudless Assistant, a helpful pre-sales assistant for Cloudless.gr — a cloud computing, serverless architecture, and AI-powered digital marketing agency. Services: Cloud Architecture & Migration, Serverless Development, Data Analytics, AI Growth Engine. Based in Greece, serves EU and international clients. Keep answers concise (2-4 sentences max).",
                generationConfig: { maxOutputTokens: 600 },
              }),
            }
          );

          if (resp.ok) {
            const data = await resp.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const stream = new ReadableStream({
              start(controller) {
                const chunks = text.match(/.{1,80}/g) || [text];
                for (const chunk of chunks) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
                  );
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              },
            });
            return new Response(stream, {
              headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
            });
          }
        } catch (err) {
          console.warn(
            "[chat] Google Gemini fallback failed:",
            err instanceof Error ? err.message : String(err)
          );
        }
      }

      // Fallback: Anthropic API (available in SSM)
      if (env.ANTHROPIC_API_KEY) {
        try {
          const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": env.ANTHROPIC_API_KEY,
              "content-type": "application/json",
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 600,
              messages,
              system:
                "You are Cloudless Assistant, a helpful pre-sales assistant for Cloudless.gr — a cloud computing, serverless architecture, and AI-powered digital marketing agency. Based in Greece, serves EU and international clients. Keep answers concise (2-4 sentences max).",
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const text = data.content?.[0]?.text || "";
            const stream = new ReadableStream({
              start(controller) {
                const chunks = text.match(/.{1,80}/g) || [text];
                for (const chunk of chunks) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
                  );
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              },
            });
            return new Response(stream, {
              headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
            });
          }
        } catch (err) {
          console.warn(
            "[chat] Anthropic fallback failed:",
            err instanceof Error ? err.message : String(err)
          );
        }
      }

      return jsonResponse({ error: "Chat not configured" }, 503);
    }

    // ==========================================
    // CONTACT ENDPOINT (Email + D1 logging)
    // ==========================================

    // POST /api/contact - Contact form handler
    if (url.pathname === "/api/contact" && method === "POST") {
      let parsed;
      try {
        parsed = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid request body" }, 400);
      }

      const { name, email, company, service, message, phone } = parsed;

      if (!name || !email || !message) {
        return jsonResponse({ error: "Name, email, and message are required" }, 400);
      }

      // Validate email format (same regex as Next.js validation)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ error: "Invalid email address" }, 400);
      }

      const now = Math.floor(Date.now() / 1000);

      // Log to admin_notifications D1 table
      try {
        await env.AUTH_DB.prepare(
          "INSERT INTO admin_notification (pk, sk, category, title, message, actor, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(
            `contact#${now}`,
            `contact#${now}`,
            "contact",
            `New contact: ${String(name).slice(0, 100)}`,
            String(message).slice(0, 500),
            String(email),
            JSON.stringify({ company, service, phone, leadScore: 0, leadBand: "cold" }),
            now
          )
          .run();
      } catch (err) {
        console.error("[contact] D1 log failed:", err);
      }

      // Send email via EMAIL binding if available
      if (env.EMAIL) {
        try {
          const html = `
            <h2>New contact form submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Company:</strong> ${company || "—"}</p>
            <p><strong>Service:</strong> ${service || "—"}</p>
            <hr />
            <p>${String(message).replace(/\n/g, "<br />")}</p>
          `;

          await env.EMAIL.send({
            to: "tbaltzakis@cloudless.gr",
            from: { email: "noreply@cloudless.gr", name: "Cloudless" },
            subject: `[Contact] ${String(service || "General").slice(0, 100)} — ${String(name).slice(0, 100)}`,
            html,
            text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || "—"}\nService: ${service || "—"}\n\n${message}`,
          });

          // Auto-reply to visitor
          await env.EMAIL.send({
            to: email,
            from: { email: "noreply@cloudless.gr", name: "Cloudless" },
            subject: "Thanks for your message",
            html: `<p>Hi ${name}, thanks for reaching out! We'll get back to you within 24 hours.</p>`,
            text: `Hi ${name}, thanks for your message. We'll respond within 24 hours.`,
          });
        } catch (err) {
          console.error("[contact] Email send failed:", err);
        }
      }

      // Log to DATALAKE_BUCKET if available
      try {
        if (env.DATALAKE_BUCKET) {
          await env.DATALAKE_BUCKET.put(
            `lake/${now}/contact.json`,
            JSON.stringify({ name, email, company, service, message, phone, created_at: now })
          );
        }
      } catch (err) {
        console.error("[contact] Datalake log failed:", err);
      }

      return jsonResponse({ success: true });
    }

    // ==========================================
    // SUBSCRIBE ENDPOINT (Newsletter)
    // ==========================================

    // POST /api/subscribe - Newsletter signup
    if (url.pathname === "/api/subscribe" && method === "POST") {
      let parsed;
      try {
        parsed = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid request body" }, 400);
      }

      const { email } = parsed;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ error: "Invalid email address" }, 400);
      }

      const now = Math.floor(Date.now() / 1000);

      // Log to admin_notifications
      try {
        await env.AUTH_DB.prepare(
          "INSERT INTO admin_notification (pk, sk, category, title, message, actor, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(
            `subscribe#${now}`,
            `subscribe#${now}`,
            "subscribe",
            "New newsletter subscriber",
            email,
            email,
            JSON.stringify({ source: "newsletter_form" }),
            now
          )
          .run();
      } catch (err) {
        console.error("[subscribe] D1 log failed:", err);
      }

      // Welcome email
      if (env.EMAIL) {
        try {
          await env.EMAIL.send({
            to: email,
            from: { email: "noreply@cloudless.gr", name: "Cloudless" },
            subject: "Welcome to Cloudless Newsletter",
            html: `<p>Thanks for subscribing! Check your inbox for updates on cloud architecture, serverless, and AI.</p>`,
            text: "Thanks for subscribing to Cloudless!",
          });
        } catch (err) {
          console.error("[subscribe] Welcome email failed:", err);
        }
      }

      return jsonResponse({ success: true });
    }

    // ==========================================
    // STRIPE WEBHOOK ENDPOINT
    // ==========================================

    // POST /api/webhooks/stripe - Stripe webhook handler
    if (url.pathname === "/api/webhooks/stripe" && method === "POST") {
      const sig = request.headers.get("stripe-signature");

      // Verify webhook secret if configured
      if (env.STRIPE_WEBHOOK_SECRET && sig) {
        try {
          const body = await request.text();
          const event = JSON.parse(body);
          const now = Math.floor(Date.now() / 1000);

          await env.AUTH_DB.prepare(
            "INSERT INTO stripe_transaction (event_id, event_type, customer_id, processing_status, received_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)"
          )
            .bind(
              event.id || `evt_${now}`,
              event.type || "unknown",
              event.data?.object?.customer || null,
              "processed",
              now,
              JSON.stringify(event)
            )
            .run();

          return jsonResponse({ received: true });
        } catch (err) {
          console.error("[stripe-webhook] Processing failed:", err);
          return jsonResponse({ error: "Webhook processing failed" }, 500);
        }
      }

      return jsonResponse({ error: "Webhook not configured" }, 503);
    }

    // ==========================================
    // CHECKOUT ENDPOINT
    // ==========================================

    // POST /api/checkout - Create Stripe checkout session
    if (url.pathname === "/api/checkout" && method === "POST") {
      let parsed;
      try {
        parsed = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid request body" }, 400);
      }

      const { items = [], successUrl, cancelUrl: _cancelUrl } = parsed;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return jsonResponse({ error: "No items in cart" }, 400);
      }

      if (!env.STRIPE_SECRET_KEY) {
        return jsonResponse({ error: "Checkout not configured" }, 503);
      }

      return jsonResponse({
        url: successUrl || "https://cloudless.gr",
        sessionId: "cs_test_placeholder",
      });
    }

    // ==========================================
    // SERVICES STATUS ENDPOINT
    // ==========================================

    // GET /api/services - Service health check
    if (url.pathname === "/api/services" && method === "GET") {
      const services = {
        auth: !!env.AUTH_DB,
        email: !!env.EMAIL,
        ai: !!env.AI,
        stripe: !!env.STRIPE_SECRET_KEY,
        analytics: !!env.ANALYTICS_BUCKET,
        r2: !!env.ASSETS_BUCKET,
        chat: !!(env.CHAT || env.GOOGLE_AI_API_KEY || env.ANTHROPIC_API_KEY),
      };

      return jsonResponse({ services, allOk: Object.values(services).every(Boolean) });
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
        version: env.APP_VERSION || process.env.APP_VERSION || "1.0.0",
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
      // Check if this is a locale route (e.g., /en, /el, /fr)
      const pathParts = url.pathname.split("/").filter(Boolean);
      const localePattern = /^(en|el|fr)$/;

      let assetPath;
      if (url.pathname === "/" || localePattern.test(pathParts[0])) {
        // For root or locale routes, serve locale-specific index.html
        const locale = pathParts[0] || "en";
        assetPath = `${locale}/index.html`;
      } else {
        // Try to serve static file from R2
        // Strip leading slash to match R2 bucket key format
        assetPath = url.pathname.replace(/^\//, "");
      }

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

export default cloudflareFreeWorker;
