// Unified Edge Runtime Controller
// Migrates AWS SSM, Lambda, S3, Athena, and Cognito to Cloudflare Free Tier
// 
// Layer 1: D1 Auth replaces Cognito
// Layer 2: R2 Storage replaces S3
// Layer 3: DuckDB-Wasm endpoint for analytics (client queries parquet)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ==========================================
    // LAYER 1: COGNITO COUPLING (EDGE AUTHENTICATION)
    // ==========================================
    if (url.pathname === "/api/login" && request.method === "POST") {
      const { username, password } = await request.json();
      
      const { results } = await env.AUTH_DB.prepare(
        "SELECT * FROM user WHERE username = ?"
      ).bind(username).all();
      
      const user = results[0];
      if (!user) return new Response("Access Denied", { status: 401 });

      const sessionId = crypto.randomUUID();
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;

      await env.AUTH_DB.prepare(
        "INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)"
      ).bind(sessionId, user.id, expiresAt).run();

      return new Response(JSON.stringify({ status: "Authenticated" }), {
        headers: {
          "Set-Cookie": `session_token=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict`,
          "Content-Type": "application/json"
        }
      });
    }

    // ==========================================
    // LAYER 2: LAMBDA COMPUTE & S3 FILE WRITING
    // ==========================================
    if (url.pathname === "/api/upload" && request.method === "POST") {
      // Inline execution of SSM secrets with 0ms network latency overhead
      const secureKey = env.PROD_DATABASE_PASSWORD; 
      const payload = await request.json();

      // Write objects directly to R2 bucket storage replacing S3 SDK
      const fileId = crypto.randomUUID();
      await env.MEDIA_BUCKET.put(`uploads/${fileId}.json`, JSON.stringify(payload));

      return new Response(JSON.stringify({ status: "Success", object: fileId }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ==========================================
    // LAYER 3: ATHENA DATA LAKE BROKERING
    // ==========================================
    if (url.pathname === "/api/analytics") {
      const parquetTarget = url.searchParams.get("file"); // e.g. metrics.parquet
      if (!parquetTarget) return new Response("Missing target parameter", { status: 400 });

      // Accept Range Requests directly from client-side DuckDB-Wasm
      const clientRange = request.headers.get("Range");
      const readOptions = clientRange ? { range: clientRange } : {};

      const dataLakeFile = await env.DATALAKE_BUCKET.get(parquetTarget, readOptions);
      if (!dataLakeFile) return new Response("Data Set Missing", { status: 404 });

      const transportHeaders = new Headers();
      dataLakeFile.writeHttpMetadata(transportHeaders);
      transportHeaders.set("Access-Control-Allow-Origin", "*");
      transportHeaders.set("Accept-Ranges", "bytes");

      return new Response(dataLakeFile.body, { headers: transportHeaders });
    }

    return new Response("Resource Path Not Configured", { status: 404 });
  }
};