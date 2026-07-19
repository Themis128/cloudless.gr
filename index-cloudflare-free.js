// Unified Edge Runtime Controller
// Migrates AWS SSM, Lambda, S3, Athena, and Cognito to Cloudflare Free Tier
//
// Layer 1: D1 Auth replaces Cognito (email/password)
// Layer 2: R2 Storage replaces S3
// Layer 3: DuckDB-Wasm endpoint for analytics (client queries parquet)

const SESSION_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days
const RESET_TOKEN_EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

// Module-level origin for CORS
let _requestOrigin = "";

/**
 * Security headers applied to all responses
 * Mirror the Next.js middleware (src/proxy.ts) for consistency
 */
function addSecurityHeaders(headers) {
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    [
      "accelerometer=()",
      "autoplay=(self)",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "hid=()",
      "idle-detection=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=(self)",
      "picture-in-picture=()",
      "publickey-credentials-get=(self)",
      "screen-wake-lock=()",
      "serial=()",
      "usb=()",
      "web-share=(self)",
      "xr-spatial-tracking=()",
    ].join(", "),
  );
  // Report-To header for CSP endpoint group
  headers.set(
    "Report-To",
    JSON.stringify({
      group: "csp-endpoint",
      max_age: 86400,
      endpoints: [{ url: "/api/csp-report" }],
      include_subdomains: true,
    }),
  );
  // CSP header (report-only style - reports violations but doesn't block)
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.com https://connect.facebook.net https://browser.sentry-cdn.com https://js.hsforms.net https://js.hs-scripts.com https://js-eu1.hs-scripts.com https://www.googletagmanager.com",
      "form-action 'self' https://www.facebook.com https://connect.facebook.net",
      "report-uri /api/csp-report",
      "report-to csp-endpoint",
    ].join("; "),
  );
}

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

function corsHeaders() {
  const allowedOrigins = [
    "https://cloudless.gr",
    "https://staging.cloudless.gr",
    "https://www.cloudless.gr",
    "http://localhost:4000",
    "http://localhost:8787",
  ];
  const corsOrigin = allowedOrigins.includes(_requestOrigin) ? _requestOrigin : allowedOrigins[0];
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
    headers: { "Content-Type": "application/json", ...corsHeaders(), ...extraHeaders },
  });
}

// Static services fallback (embedded in Worker)
const staticServices = [
  {
    id: "cloud-audit",
    slug: "cloud-audit",
    name: "Cloud Audit",
    description: "A deep-dive into your AWS infrastructure to uncover hidden costs, security gaps, and performance bottlenecks. Delivered within 5 business days.",
    price: "From €1,500",
    category: "audit",
    icon: "🔍",
    features: ["Full cost breakdown by service and team", "Security misconfiguration report", "Performance & latency analysis", "Prioritised remediation roadmap", "90-day follow-up check"],
    cta: "Book an audit",
  },
  {
    id: "architecture-review",
    slug: "architecture-review",
    name: "Architecture Review",
    description: "Expert evaluation of your system design against AWS Well-Architected Framework pillars: reliability, security, performance, and cost.",
    price: "From €2,000",
    category: "consulting",
    icon: "🏗️",
    features: ["Well-Architected Framework assessment", "Scalability & reliability analysis", "Disaster recovery evaluation", "Written recommendations report", "60-min debrief call"],
    cta: "Request a review",
  },
  {
    id: "serverless-migration",
    slug: "serverless-migration",
    name: "Serverless Migration",
    description: "End-to-end migration from VMs or containers to serverless architecture, with zero-downtime cutover and full monitoring from day one.",
    price: "From €5,000",
    category: "devops",
    icon: "⚡",
    features: ["Strangler-fig or big-bang migration strategy", "Lambda + API Gateway + EventBridge wiring", "CI/CD pipeline setup (GitHub Actions / CodePipeline)", "Observability from day one (CloudWatch / Sentry)", "Knowledge transfer & runbook"],
    cta: "Start a migration",
  },
  {
    id: "monthly-retainer",
    slug: "monthly-retainer",
    name: "Monthly Retainer",
    description: "A senior AWS-certified cloud architect on your team — available for design reviews, incident response, and ongoing cost optimisation.",
    price: "€1,500/mo",
    category: "consulting",
    icon: "🤝",
    features: ["Up to 20 hours/month cloud architecture support", "Unlimited async questions (email / Slack)", "Monthly infrastructure review", "On-call incident support", "Cancel any time"],
    cta: "Start a retainer",
  },
];

// Static blog posts fallback
const staticBlogPosts = [
  { slug: "why-serverless-is-perfect-for-startups", title: "Why Serverless Is Perfect for Startups in 2026", excerpt: "Serverless architecture lets startups ship faster, pay only for what they use, and scale effortlessly.", date: "2026-03-28", readTime: "5 min read", category: "Serverless" },
  { slug: "cloud-cost-optimization-guide", title: "AWS Cost Optimization for Startups: 5 Mistakes Costing You 30–40% More", excerpt: "Most startups overspend on AWS by 30–40%.", date: "2026-03-21", readTime: "7 min read", category: "Cloud" },
  { slug: "ai-marketing-small-business", title: "AI Marketing for Small Business: A Practical Guide", excerpt: "You don't need a massive budget to use AI in your marketing.", date: "2026-03-14", readTime: "6 min read", category: "AI Marketing" },
  { slug: "data-analytics-dashboards-for-growth", title: "How Data Dashboards Drive Smarter Decisions", excerpt: "Real-time dashboards turn raw data into growth levers.", date: "2026-03-07", readTime: "5 min read", category: "Analytics" },
  { slug: "cloud-migration-guide-small-business", title: "Cloud Migration Guide for Small Businesses (2026)", excerpt: "A step-by-step cloud migration plan for SMBs.", date: "2026-06-18", readTime: "10 min read", category: "Cloud" },
  { slug: "serverless-development-agency-europe", title: "Why Choose a Serverless Development Agency in Europe", excerpt: "Serverless development agencies cut your infrastructure costs by 60–80%.", date: "2026-06-18", readTime: "8 min read", category: "Serverless" },
];

// Static testimonials fallback
const staticTestimonials = [
  { id: "t1", name: "Alexandros Papadopoulos", company: "TechFlow Athens", role: "CTO", quote: "Cloudless cut our AWS bill by 55% in the first month.", service: "Cloud Audit", rating: 5, featured: true },
  { id: "t2", name: "Maria Stavridou", company: "Retail Plus", role: "Head of Engineering", quote: "We migrated a monolith to serverless in 6 weeks.", service: "Architecture Migration", rating: 5, featured: true },
  { id: "t3", name: "Nikos Theodorakis", company: "FinStart GR", role: "Founder & CEO", quote: "The monthly retainer gives us a senior cloud architect on call.", service: "Monthly Retainer", rating: 5, featured: false },
];

// Static FAQs fallback
const staticFaqs = [
  { id: "f1", question: "How long does a cloud audit take?", answer: "A standard cloud audit is delivered within 5 business days.", category: "process", locales: [] },
  { id: "f2", question: "Do you work with other cloud providers besides AWS?", answer: "Our core expertise is AWS, but we can advise on GCP and Azure.", category: "technical", locales: [] },
  { id: "f3", question: "What is the minimum engagement size?", answer: "The smallest engagement is the Cloud Audit at €1,500.", category: "pricing", locales: [] },
  { id: "f4", question: "Can you help us pass a SOC 2 or ISO 27001 audit?", answer: "Yes. Cloud Audits cover security misconfigurations.", category: "technical", locales: [] },
  { id: "f5", question: "Do you sign NDAs?", answer: "Yes, we sign mutual NDAs before any engagement.", category: "general", locales: [] },
  { id: "f6", question: "How does the monthly retainer work?", answer: "You get up to 20 hours of senior cloud architecture support per month.", category: "pricing", locales: [] },
];

// Static case studies fallback
const staticCaseStudies = [
  {
    id: "cs1", slug: "techflow-aws-cost-reduction", title: "55% AWS Cost Reduction for a SaaS Startup", client: "TechFlow Athens", industry: "SaaS",
    services: ["Cloud Audit", "Cost Optimization"],
    summary: "Cloudless identified over-provisioned resources and redesigned the data pipeline architecture, cutting AWS spend by 55% in 30 days.",
    challenge: "TechFlow was spending €8,000/month on AWS with no clear understanding of where the money was going.",
    solution: "A full infrastructure audit mapped every resource to its cost. Right-sizing EC2 instances, migrating batch jobs to Lambda.",
    results: "Monthly AWS bill dropped from €8,000 to €3,600 within 30 days.",
    metrics: [{ label: "Cost reduction", value: "55%" }, { label: "Time to results", value: "30 days" }, { label: "Monthly savings", value: "€4,400" }],
    tags: ["AWS", "Cost optimization", "SaaS"], featured: true, date: "2026-03-01",
  },
  {
    id: "cs2", slug: "retail-plus-serverless-migration", title: "Monolith to Serverless in 6 Weeks", client: "Retail Plus", industry: "E-commerce",
    services: ["Architecture Migration", "DevOps"],
    summary: "A 4-year-old Django monolith was decomposed into serverless microservices with zero downtime.",
    challenge: "Retail Plus had outgrown their monolithic application. Each deployment took 45 minutes.",
    solution: "Critical business domains were extracted into Lambda functions behind API Gateway.",
    results: "Deployment time fell from 45 minutes to under 4 minutes. Infrastructure cost dropped 40%.",
    metrics: [{ label: "Deploy time", value: "−90%" }, { label: "Infrastructure cost", value: "−40%" }, { label: "Migration duration", value: "6 weeks" }],
    tags: ["Serverless", "Lambda", "Migration", "E-commerce"], featured: true, date: "2026-01-15",
  },
];

export default {
  async fetch(request, env, ctx) {
    _requestOrigin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const method = request.method;
    const host = url.hostname;

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      // ==========================================
      // WWW REDIRECT - canonical domain handling
      // ==========================================
      if (host === "www.cloudless.gr") {
        const canonicalUrl = url.origin.replace("www.cloudless.gr", "cloudless.gr") + url.pathname + url.search;
        return new Response(null, { status: 301, headers: { Location: canonicalUrl, "Cache-Control": "public, max-age=3600" } });
      }

      // ==========================================
      // LAYER 1: D1 AUTHENTICATION (EDGE)
      // ==========================================

      // POST /api/auth/register
      if (url.pathname === "/api/auth/register" && method === "POST") {
        let parsed;
        try { parsed = await request.json(); } catch { return jsonResponse({ error: "Invalid request body" }, 400); }
        const { email, password, name } = parsed;
        if (!email || !password) { return jsonResponse({ error: "Email and password required" }, 400); }

        const SESSION_SECRET = env.SESSION_SECRET || "";
        if (!SESSION_SECRET) { return jsonResponse({ error: "Authentication not configured" }, 503); }

        const { results: existing } = await env.AUTH_DB.prepare("SELECT id FROM user WHERE email = ?").bind(email.toLowerCase().trim()).all();
        if (existing.length > 0) { return jsonResponse({ error: "User already exists" }, 400); }

        const id = crypto.randomUUID();
        const passwordHash = await hashPassword(password, SESSION_SECRET);
        const now = Math.floor(Date.now() / 1000);

        await env.AUTH_DB.prepare("INSERT INTO user (id, email, name, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, email.toLowerCase().trim(), name || null, email.toLowerCase().trim(), passwordHash, now, now).run();
        await env.AUTH_DB.prepare("INSERT INTO user_role (user_id, role) VALUES (?, ?)").bind(id, "user").run();

        return jsonResponse({ ok: true, user: { id, email, name: name || null } });
      }

      // POST /api/auth/login
      if (url.pathname === "/api/auth/login" && method === "POST") {
        let parsed;
        try { parsed = await request.json(); } catch { return jsonResponse({ error: "Invalid request body" }, 400); }
        const { email, password } = parsed;
        if (!email || !password) { return jsonResponse({ error: "Email and password required" }, 400); }

        const SESSION_SECRET = env.SESSION_SECRET || "";
        if (!SESSION_SECRET) { return jsonResponse({ error: "Authentication not configured" }, 503); }

        const { results } = await env.AUTH_DB.prepare("SELECT * FROM user WHERE email = ?").bind(email.toLowerCase().trim()).all();
        const user = results[0];
        if (!user) { return jsonResponse({ error: "Invalid credentials" }, 401); }

        const passwordHash = await hashPassword(password, SESSION_SECRET);
        if (passwordHash !== user.password_hash) { return jsonResponse({ error: "Invalid credentials" }, 401); }

        const { results: roleResults } = await env.AUTH_DB.prepare("SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'").bind(user.id).all();
        const isAdmin = roleResults.length > 0;

        const sessionId = crypto.randomUUID();
        const expiresAt = Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS;

        await env.AUTH_DB.prepare("INSERT INTO session (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(sessionId, user.id, expiresAt, Math.floor(Date.now() / 1000)).run();

        return new Response(JSON.stringify({ ok: true, user: { id: user.id, email: user.email, name: user.name, company: user.company, phone: user.phone }, isAdmin }), {
          headers: { "Set-Cookie": `session_token=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_EXPIRY_SECONDS}`, "Content-Type": "application/json", ...corsHeaders() },
        });
      }

      // POST /api/auth/logout
      if (url.pathname === "/api/auth/logout" && method === "POST") {
        const sessionId = request.headers.get("Cookie")?.match(/session_token=([^;]+)/)?.[1];
        if (sessionId) { await env.AUTH_DB.prepare("DELETE FROM session WHERE id = ?").bind(sessionId).run(); }
        const response = jsonResponse({ ok: true });
        response.headers.append("Set-Cookie", "session_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
        return response;
      }

      // POST /api/auth/reset-password
      if (url.pathname === "/api/auth/reset-password" && method === "POST") {
        let parsed;
        try { parsed = await request.json(); } catch { return jsonResponse({ error: "Invalid request body" }, 400); }
        const { email } = parsed;
        if (!email) { return jsonResponse({ error: "Email required" }, 400); }

        const { results } = await env.AUTH_DB.prepare("SELECT id, preferences_json FROM user WHERE email = ?").bind(email.toLowerCase().trim()).all();
        if (results.length === 0) { return jsonResponse({ ok: true }); }

        const user = results[0];
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const token = btoa(String.fromCharCode(...Array.from(bytes)));
        const expiresAt = Math.floor(Date.now() / 1000) + RESET_TOKEN_EXPIRY_SECONDS;

        await env.AUTH_DB.prepare("UPDATE user SET preferences_json = json_set(COALESCE(preferences_json, '{}'), '$.reset_token', ?, '$.reset_expires', ?) WHERE id = ?").bind(token, expiresAt, user.id).run();

        const resetUrl = `${url.origin}/auth/reset-confirm?token=${encodeURIComponent(token)}`;
        try {
          if (env.EMAIL) {
            await env.EMAIL.send({
              to: email, from: { email: "noreply@cloudless.gr", name: "Cloudless" }, subject: "Reset your Cloudless password",
              html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #00fff5;">Reset your password</h2><p>Click the link below to set a new password:</p><p><a href="${resetUrl}" style="color: #00fff5;">${resetUrl}</a></p><p style="color: #888; font-size: 12px;">Link expires in 24 hours.</p></div>`,
              text: `Reset your password: ${resetUrl}\nLink expires in 24 hours.`,
            });
          }
        } catch { /* Ignore email errors */ }

        return jsonResponse({ ok: true });
      }

      // POST /api/auth/reset-confirm
      if (url.pathname === "/api/auth/reset-confirm" && method === "POST") {
        let parsed;
        try { parsed = await request.json(); } catch { return jsonResponse({ error: "Invalid request body" }, 400); }
        const { token, newPassword, confirmPassword } = parsed;
        if (!token || !newPassword || !confirmPassword) { return jsonResponse({ error: "Token and passwords required" }, 400); }
        if (newPassword !== confirmPassword) { return jsonResponse({ error: "Passwords do not match" }, 400); }
        if (newPassword.length < 8) { return jsonResponse({ error: "Password must be at least 8 characters" }, 400); }

        const now = Math.floor(Date.now() / 1000);
        const { results } = await env.AUTH_DB.prepare("SELECT id, preferences_json FROM user WHERE json_extract(preferences_json, '$.reset_token') = ? AND json_extract(preferences_json, '$.reset_expires') > ?").bind(token, now).all();
        if (results.length === 0) { return jsonResponse({ error: "Invalid or expired reset token" }, 400); }

        const user = results[0];
        const SESSION_SECRET = env.SESSION_SECRET || "";
        const passwordHash = await hashPassword(newPassword, SESSION_SECRET);
        const prefs = JSON.parse(user.preferences_json || "{}");
        delete prefs.reset_token;
        delete prefs.reset_expires;

        await env.AUTH_DB.prepare("UPDATE user SET password_hash = ?, preferences_json = ? WHERE id = ?").bind(passwordHash, JSON.stringify(prefs), user.id).run();
        await env.AUTH_DB.prepare("DELETE FROM session WHERE user_id = ?").bind(user.id).run();

        return jsonResponse({ ok: true });
      }

      // GET /api/auth/session
      if (url.pathname === "/api/auth/session" && method === "GET") {
        const sessionId = request.headers.get("Cookie")?.match(/session_token=([^;]+)/)?.[1];
        if (!sessionId) { return jsonResponse({ user: null }); }

        const now = Math.floor(Date.now() / 1000);
        const { results: sessionResults } = await env.AUTH_DB.prepare("SELECT * FROM session WHERE id = ? AND expires_at > ?").bind(sessionId, now).all();
        if (sessionResults.length === 0) {
          const response = jsonResponse({ user: null });
          response.headers.append("Set-Cookie", "session_token=; Path=/; HttpOnly; Max-Age=0");
          return response;
        }
        const session = sessionResults[0];
        const { results: userResults } = await env.AUTH_DB.prepare("SELECT id, email, name, company, phone, preferences_json FROM user WHERE id = ?").bind(session.user_id).all();
        if (userResults.length === 0) { return jsonResponse({ user: null }); }

        const user = userResults[0];
        const { results: roleResults } = await env.AUTH_DB.prepare("SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'").bind(user.id).all();

        return jsonResponse({ user: { id: user.id, email: user.email, name: user.name, company: user.company, phone: user.phone, preferences: user.preferences_json ? JSON.parse(user.preferences_json) : {} }, isAdmin: roleResults.length > 0 });
      }

      // ==========================================
      // TIER 2: CMS CONTENT ENDPOINTS (EDGE CACHING)
      // ==========================================

      // GET /api/services - Services catalog
      if (url.pathname === "/api/services" && method === "GET") {
        const category = url.searchParams.get("category");
        let data = category ? staticServices.filter((s) => s.category === category) : staticServices;

        if (env.ADMIN_API) {
          try {
            const servicesResp = await env.ADMIN_API.fetchServiceCatalog({ path: url.pathname, search: url.search });
            if (servicesResp && servicesResp.ok) { return jsonResponse(servicesResp, 200, { "Cache-Control": "public, max-age=300" }); }
          } catch (err) { console.warn("[services] Service binding failed, using static:", err instanceof Error ? err.message : err); }
        }

        return jsonResponse({ services: data, source: "static", fallbackReason: "notion-not-configured" }, 200, { "Cache-Control": "public, max-age=300, stale-while-revalidate=60", "x-cms-source": "static" });
      }

      // GET /api/blog - Blog posts list
      if (url.pathname === "/api/blog" && method === "GET") {
        const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
        let posts = limit ? staticBlogPosts.slice(0, limit) : staticBlogPosts;

        if (env.ADMIN_API) {
          try {
            const blogResp = await env.ADMIN_API.fetchBlog({ path: url.pathname, search: url.search });
            if (blogResp && blogResp.ok) { return jsonResponse(blogResp, 200, { "Cache-Control": "public, max-age=300" }); }
          } catch (err) { console.warn("[blog] Service binding failed, using static:", err instanceof Error ? err.message : err); }
        }

        return jsonResponse({ posts, source: "static", fallbackReason: "notion-not-configured" }, 200, { "Cache-Control": "public, max-age=300, stale-while-revalidate=60", "x-blog-source": "static" });
      }

      // GET /api/blog/[slug]
      if (url.pathname.startsWith("/api/blog/") && method === "GET") {
        const slug = url.pathname.slice("/api/blog/".length);
        const post = staticBlogPosts.find((p) => p.slug === slug);

        if (env.ADMIN_API && slug) {
          try {
            const postResp = await env.ADMIN_API.fetchBlogPost({ slug });
            if (postResp && postResp.ok) { return jsonResponse(postResp, 200, { "Cache-Control": "public, max-age=300" }); }
          } catch (err) { console.warn("[blog/slug] Service binding failed:", err instanceof Error ? err.message : err); }
        }

        if (!post) { return jsonResponse({ error: "Post not found" }, 404); }
        return jsonResponse({ post, source: "static" }, 200, { "Cache-Control": "public, max-age=300, stale-while-revalidate=60", "x-blog-source": "static" });
      }

      // GET /api/case-studies
      if (url.pathname === "/api/case-studies" && method === "GET") {
        const featured = url.searchParams.get("featured") === "true";
        let data = featured ? staticCaseStudies.filter((c) => c.featured) : staticCaseStudies;

        if (env.ADMIN_API) {
          try {
            const caseStudiesResp = await env.ADMIN_API.fetchCaseStudies({ path: url.pathname, search: url.search });
            if (caseStudiesResp && caseStudiesResp.ok) { return jsonResponse(caseStudiesResp, 200, { "Cache-Control": "public, max-age=300" }); }
          } catch (err) { console.warn("[case-studies] Service binding failed, using static:", err instanceof Error ? err.message : err); }
        }

        return jsonResponse({ caseStudies: data, source: "static", fallbackReason: "notion-not-configured" }, 200, { "Cache-Control": "public, max-age=300, stale-while-revalidate=60", "x-cms-source": "static" });
      }

      // GET /api/case-studies/[slug]
      if (url.pathname.startsWith("/api/case-studies/") && method === "GET") {
        const slug = url.pathname.slice("/api/case-studies/".length);
        const cs = staticCaseStudies.find((c) => c.slug === slug);

        if (env.ADMIN_API && slug) {
          try {
            const csResp = await env.ADMIN_API.fetchCaseStudy({ slug });
            if (csResp && csResp.ok) { return jsonResponse(csResp, 200, { "Cache-Control": "public, max-age=300" }); }
          } catch (err) { console.warn("[case-studies/slug] Service binding failed:", err instanceof Error ? err.message : err); }
        }

        if (!cs) { return jsonResponse({ error: "Not found" }, 404); }
        return jsonResponse({ caseStudy: { ...cs, html: "" }, source: "static" }, 200, { "Cache-Control": "public, max-age=300, stale-while-revalidate=60", "x-cms-source": "static" });
      }

      // GET /api/testimonials
      if (url.pathname === "/api/testimonials" && method === "GET") {
        const featured = url.searchParams.get("featured") === "true";
        const data = featured ? staticTestimonials.filter((t) => t.featured) : staticTestimonials;

        if (env.ADMIN_API) {
          try {
            const testimonialsResp = await env.ADMIN_API.fetchTestimonials({ path: url.pathname, search: url.search });
            if (testimonialsResp && testimonialsResp.ok) { return jsonResponse(testimonialsResp, 200, { "Cache-Control": "public, max-age=300" }); }
          } catch (err) { console.warn("[testimonials] Service binding failed, using static:", err instanceof Error ? err.message : err); }
        }

        return jsonResponse({ testimonials: data, source: "static", fallbackReason: "notion-not-configured" }, 200, { "Cache-Control": "public, max-age=300, stale-while-revalidate=60", "x-cms-source": "static" });
      }

      // GET /api/faqs
      if (url.pathname === "/api/faqs" && method === "GET") {
        const locale = url.searchParams.get("locale") ?? undefined;
        const category = url.searchParams.get("category") ?? undefined;
        let data = staticFaqs;
        if (locale) { data = data.filter((f) => f.locales.length === 0 || f.locales.includes(locale)); }
        if (category) { data = data.filter((f) => f.category === category); }

        if (env.ADMIN_API) {
          try {
            const faqsResp = await env.ADMIN_API.fetchFaqs({ path: url.pathname, search: url.search });
            if (faqsResp && faqsResp.ok) { return jsonResponse(faqsResp, 200, { "Cache-Control": "public, max-age=300" }); }
          } catch (err) { console.warn("[faqs] Service binding failed, using static:", err instanceof Error ? err.message : err); }
        }

        return jsonResponse({ faqs: data, source: "static", fallbackReason: "notion-not-configured" }, 200, { "Cache-Control": "public, max-age=300, stale-while-revalidate=60", "x-cms-source": "static" });
      }

      // GET /api/docs
      if (url.pathname === "/api/docs" && method === "GET") {
        if (env.ADMIN_API) {
          try {
            const docsResp = await env.ADMIN_API.fetchDocs({ path: url.pathname, search: url.search });
            if (docsResp && docsResp.ok) { return jsonResponse(docsResp, 200, { "Cache-Control": "public, max-age=300" }); }
          } catch (err) { console.warn("[docs] Service binding failed:", err instanceof Error ? err.message : err); }
        }

        return jsonResponse({ docs: [], grouped: {}, source: "static", fallbackReason: "notion-not-configured" }, 200, { "Cache-Control": "public, max-age=300", "x-cms-source": "static" });
      }

      // GET /api/recommendations
      if (url.pathname === "/api/recommendations" && method === "GET") {
        const type = (url.searchParams.get("type") as "similar" | "trending") || "trending";
        const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit")) || 4), 20);

        const defaultProducts = [
          { id: "srv-cloud", name: "Cloud Architecture Audit", description: "Comprehensive review of your cloud infrastructure.", price: 200000, currency: "eur", category: "service", image: "/store/cloud-audit.svg" },
          { id: "srv-serverless", name: "Serverless Starter Package", description: "Get your first serverless application built.", price: 240000, currency: "eur", category: "service", image: "/store/serverless-starter.svg" },
        ];

        let recommendations = [];
        if (type === "trending") { recommendations = defaultProducts.slice(0, limit); }

        if (env.ADMIN_API) {
          try {
            const recsResp = await env.ADMIN_API.fetchRecommendations({ path: url.pathname, search: url.search });
            if (recsResp && recsResp.ok) { return jsonResponse(recsResp, 200, { "Cache-Control": "public, max-age=300" }); }
          } catch (err) { console.warn("[recommendations] Service binding failed, using static:", err instanceof Error ? err.message : err); }
        }

        return jsonResponse({ recommendations, type }, 200, { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" });
      }

      // ==========================================
      // LAYER 2: R2 STORAGE (STATIC ASSETS)
      // ==========================================
      if (url.pathname.startsWith("/static/") || url.pathname.startsWith("/assets/")) {
        const assetPath = url.pathname.slice(1);
        const asset = await env.ASSETS_BUCKET.get(assetPath);
        if (!asset) { return new Response("Not found", { status: 404, headers: corsHeaders() }); }

        const headers = new Headers();
        asset.writeHttpMetadata(headers);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
        return new Response(asset.body, { headers });
      }

      // ==========================================
      // LAYER 3: ANALYTICS ENDPOINT
      // ==========================================

      // GET /api/analytics/r2
      if (url.pathname === "/api/analytics/r2" && method === "GET") {
        const file = url.searchParams.get("file");
        if (!file) { return new Response("Missing file parameter", { status: 400, headers: corsHeaders() }); }
        if (!/^[a-zA-Z0-9_\\-./]+\\.parquet$/.test(file)) { return new Response("Invalid filename", { status: 400, headers: corsHeaders() }); }

        const rangeHeader = request.headers.get("range");
        const options = {};

        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=(\\d+)-(\\d*)/);
          if (match) {
            const start = parseInt(match[1], 10);
            const end = match[2] ? parseInt(match[2], 10) : undefined;
            if (end) { options.range = { offset: start, length: end - start + 1 }; } else { options.range = { offset: start, length: 1024 * 1024 }; }
          }
        }

        const object = await env.ANALYTICS_BUCKET.get(`lake/${file}`, options);
        if (!object) { return new Response("Not found", { status: 404, headers: corsHeaders() }); }

        const headers = new Headers();
        headers.set("Content-Type", "application/octet-stream");
        headers.set("Accept-Ranges", "bytes");
        headers.set("Cache-Control", "public, max-age=3600");
        if (object.httpEtag) { headers.set("ETag", object.httpEtag); }
        Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
        return new Response(object.body, { headers });
      }

      // GET /api/analytics/query
      if (url.pathname === "/api/analytics/query" && method === "GET") {
        const prefix = url.searchParams.get("prefix") || "";
        const objects = await env.ANALYTICS_BUCKET.list({ prefix: `lake/${prefix}`, limit: 100 });
        const files = objects.objects.filter((obj) => obj.key.endsWith(".parquet")).map((obj) => ({ key: obj.key.replace("lake/", ""), size: obj.size, uploaded: obj.uploaded }));
        return jsonResponse({ ok: true, files, total: files.length, truncated: objects.truncated });
      }

      // ==========================================
      // ADMIN ENDPOINTS
      // ==========================================

      // GET /api/admin/auth-audit
      if (url.pathname === "/api/admin/auth-audit" && method === "GET") {
        const sessionId = request.headers.get("Cookie")?.match(/session_token=([^;]+)/)?.[1];
        if (!sessionId) { return jsonResponse({ error: "Authentication required" }, 401); }

        const now = Math.floor(Date.now() / 1000);
        const { results: sessionResults } = await env.AUTH_DB.prepare("SELECT * FROM session WHERE id = ? AND expires_at > ?").bind(sessionId, now).all();
        if (sessionResults.length === 0) { return jsonResponse({ error: "Session expired" }, 401); }

        const session = sessionResults[0];
        const { results: roleResults } = await env.AUTH_DB.prepare("SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'").bind(session.user_id).all();
        const isAdmin = roleResults.length > 0;
        if (!isAdmin) { return jsonResponse({ error: "Admin access required" }, 403); }

        const action = url.searchParams.get("action");
        const adminUserId = url.searchParams.get("adminUserId");
        const targetUserId = url.searchParams.get("targetUserId");
        const startDate = url.searchParams.get("startDate");
        const endDate = url.searchParams.get("endDate");
        const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 100));
        const offset = Number(url.searchParams.get("offset") ?? 0);

        let query = "SELECT * FROM admin_audit_log WHERE 1 = 1";
        const params = [];
        if (action) { query += " AND action = ?"; params.push(action); }
        if (adminUserId) { query += " AND admin_user_id = ?"; params.push(adminUserId); }
        if (targetUserId) { query += " AND target_user_id = ?"; params.push(targetUserId); }
        if (startDate) { query += " AND created_at >= ?"; params.push(Number(startDate)); }
        if (endDate) { query += " AND created_at <= ?"; params.push(Number(endDate)); }
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const { results } = await env.AUTH_DB.prepare(query).bind(...params).all();
        if (url.searchParams.get("count") === "true") {
          const countResult = await env.AUTH_DB.prepare("SELECT COUNT(*) as count FROM admin_audit_log").first();
          return jsonResponse({ count: countResult?.count ?? 0 });
        }

        const userResult = await env.AUTH_DB.prepare("SELECT email FROM user WHERE id = ?").bind(session.user_id).first();
        return jsonResponse({ entries: results, total: results.length, admin: userResult?.email || "unknown" });
      }

      // GET /api/admin/kpi
      if (url.pathname === "/api/admin/kpi" && method === "GET") {
        const sessionId = request.headers.get("Cookie")?.match(/session_token=([^;]+)/)?.[1];
        if (!sessionId) { return jsonResponse({ error: "Authentication required" }, 401); }

        const now = Math.floor(Date.now() / 1000);
        const { results: sessionResults } = await env.AUTH_DB.prepare("SELECT * FROM session WHERE id = ? AND expires_at > ?").bind(sessionId, now).all();
        if (sessionResults.length === 0) { return jsonResponse({ error: "Session expired" }, 401); }

        const session = sessionResults[0];
        const { results: roleResults } = await env.AUTH_DB.prepare("SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'").bind(session.user_id).all();
        if (roleResults.length === 0) { return jsonResponse({ error: "Admin access required" }, 403); }

        const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
        const [{ results: leadResults }] = await Promise.allSettled([env.AUTH_DB.prepare("SELECT COUNT(*) as count FROM admin_notification WHERE category = 'contact' AND created_at > ?").bind(thirtyDaysAgo).all()]) as any;

        if (env.ADMIN_API) {
          try {
            const kpiResp = await env.ADMIN_API.fetchKpi(session.user_id);
            if (kpiResp) {
              const response = new Response(kpiResp.body, { status: kpiResp.status, headers: { ...corsHeaders(), "Cache-Control": "private, max-age=60" } });
              return response;
            }
          } catch (err) { console.warn("[kpi] Service binding failed:", err instanceof Error ? err.message : err); }
        }

        return jsonResponse({ leads: leadResults?.[0]?.count ?? 0, analytics: null, projects: null, tasks: null, source: "d1-fallback", fetchedAt: new Date().toISOString() }, 200, { "Cache-Control": "private, max-age=60" });
      }

      // GET /api/admin/analytics/*
      if (url.pathname.startsWith("/api/admin/analytics") && method === "GET") {
        const sessionId = request.headers.get("Cookie")?.match(/session_token=([^;]+)/)?.[1];
        if (!sessionId) { return jsonResponse({ error: "Authentication required" }, 401); }

        const now = Math.floor(Date.now() / 1000);
        const { results: sessionResults } = await env.AUTH_DB.prepare("SELECT * FROM session WHERE id = ? AND expires_at > ?").bind(sessionId, now).all();
        if (sessionResults.length === 0) { return jsonResponse({ error: "Session expired" }, 401); }

        const { results: roleResults } = await env.AUTH_DB.prepare("SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'").bind(sessionResults[0].user_id).all();
        if (roleResults.length === 0) { return jsonResponse({ error: "Admin access required" }, 403); }

        if (env.ADMIN_API) {
          try {
            const analyticsData = await env.ADMIN_API.fetchAnalytics({ path: url.pathname, search: url.search });
            if (analyticsData && analyticsData.ok) { return jsonResponse(analyticsData, 200, { "Cache-Control": "private, max-age=60" }); }
          } catch (err) { console.warn("[analytics] Service binding failed:", err instanceof Error ? err.message : err); }
        }

        return jsonResponse({ error: "Analytics endpoint requires Next.js cluster or service binding", hint: "Configure ADMIN_API service binding", available: !!env.ANALYTICS_BUCKET }, 503);
      }

      // POST /api/admin/users/promote
      if (url.pathname === "/api/admin/users/promote" && method === "POST") {
        let parsed;
        try { parsed = await request.json(); } catch { return jsonResponse({ error: "Invalid request body" }, 400); }
        const { email } = parsed;
        if (!email) { return jsonResponse({ error: "Email required" }, 400); }

        const { results } = await env.AUTH_DB.prepare("SELECT id FROM user WHERE email = ?").bind(email.toLowerCase().trim()).all();
        if (results.length === 0) { return jsonResponse({ error: "User not found" }, 404); }

        const user = results[0];
        await env.AUTH_DB.prepare("INSERT OR REPLACE INTO user_role (user_id, role) VALUES (?, ?)").bind(user.id, "admin").run();
        return jsonResponse({ ok: true, message: `User ${email} promoted to admin` });
      }

      // ==========================================
      // CHAT ENDPOINT (Service Binding)
      // ==========================================

      // POST /api/chat
      if (url.pathname === "/api/chat" && method === "POST") {
        const encoder = new TextEncoder();
        let body;
        try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid request body" }, 400); }
        if (!body.messages || !Array.isArray(body.messages)) { return jsonResponse({ error: "Invalid request: messages array required" }, 400); }

        const messages = body.messages.slice(-10).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 500) }));

        if (env.CHAT) {
          try {
            const headers = {};
            for (const [key, value] of request.headers.entries()) { headers[key.toLowerCase()] = value; }
            const stream = await env.CHAT.chatStream(body.messages, headers);
            return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no", ...corsHeaders() } });
          } catch (err) { console.warn("[chat] Service binding failed, falling back:", err instanceof Error ? err.message : err); }
        }

        if (env.AI) {
          try {
            const SYSTEM_PROMPT = `You are Cloudless Assistant, a helpful pre-sales assistant for Cloudless.gr — a cloud computing, serverless architecture, and AI-powered digital marketing agency. Services: Cloud Architecture & Migration, Serverless Development, Data Analytics, AI Growth Engine. Based in Greece, serves EU and international clients. Keep answers concise (2-4 sentences max).`;
            const workersAiMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
            const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: workersAiMessages, max_tokens: 600 });
            const response = result.response || "";
            const stream = new ReadableStream({
              start(controller) {
                const chunks = response.match(/.{1,80}/g) || [response];
                for (const chunk of chunks) { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)); }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              },
            });
            return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", ...corsHeaders() } });
          } catch (err) { console.warn("[chat] Workers AI failed:", err instanceof Error ? err.message : err); }
        }

        if (env.ANTHROPIC_API_KEY) {
          try {
            const resp = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "content-type": "application/json", "anthropic-version": "2023-06-01" },
              body: JSON.stringify({ model: "claude-3-5-sonnet-20241022", max_tokens: 600, messages, system: "You are Cloudless Assistant, a helpful pre-sales assistant." }),
            });
            if (resp.ok) {
              const data = await resp.json();
              const text = data.content?.[0]?.text || "";
              const stream = new ReadableStream({
                start(controller) {
                  const chunks = text.match(/.{1,80}/g) || [text];
                  for (const chunk of chunks) { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)); }
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                },
              });
              return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...corsHeaders() } });
            }
          } catch (err) { console.warn("[chat] Anthropic fallback failed:", err instanceof Error ? err.message : err); }
        }

        return jsonResponse({ error: "Chat not configured" }, 503);
      }

      // POST /api/contact
      if (url.pathname === "/api/contact" && method === "POST") {
        let parsed;
        try { parsed = await request.json(); } catch { return jsonResponse({ error: "Invalid request body" }, 400); }
        const { name, email, company, service, message, phone } = parsed;
        if (!name || !email || !message) { return jsonResponse({ error: "Name, email, and message are required" }, 400); }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return jsonResponse({ error: "Invalid email address" }, 400); }

        const now = Math.floor(Date.now() / 1000);
        try {
          await env.AUTH_DB.prepare("INSERT INTO admin_notification (pk, sk, category, title, message, actor, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(`contact#${now}`, `contact#${now}`, "contact", `New contact: ${String(name).slice(0, 100)}`, String(message).slice(0, 500), String(email), JSON.stringify({ company, service, phone, leadScore: 0, leadBand: "cold" }), now).run();
        } catch (err) { console.error("[contact] D1 log failed:", err); }

        if (env.EMAIL) {
          try {
            await env.EMAIL.send({ to: "tbaltzakis@cloudless.gr", from: { email: "noreply@cloudless.gr", name: "Cloudless" }, subject: `[Contact] ${String(service || "General").slice(0, 100)} — ${String(name).slice(0, 100)}`, html: `<h2>New contact form submission</h2><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Company:</strong> ${company || "—"}</p><p><strong>Service:</strong> ${service || "—"}</p><hr /><p>${String(message).replace(/\n/g, "<br />")}</p>`, text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || "—"}\nService: ${service || "—"}\n\n${message}` });
            await env.EMAIL.send({ to: email, from: { email: "noreply@cloudless.gr", name: "Cloudless" }, subject: "Thanks for your message", html: `<p>Hi ${name}, thanks for reaching out! We'll get back to you within 24 hours.</p>`, text: `Hi ${name}, thanks for your message. We'll respond within 24 hours.` });
          } catch (err) { console.error("[contact] Email send failed:", err); }
        }

        return jsonResponse({ success: true });
      }

      // POST /api/subscribe
      if (url.pathname === "/api/subscribe" && method === "POST") {
        let parsed;
        try { parsed = await request.json(); } catch { return jsonResponse({ error: "Invalid request body" }, 400); }
        const { email } = parsed;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return jsonResponse({ error: "Valid email required" }, 400); }

        const now = Math.floor(Date.now() / 1000);
        try {
          await env.AUTH_DB.prepare("INSERT INTO admin_notification (pk, sk, category, title, message, actor, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(`subscribe#${now}`, `subscribe#${now}`, "subscribe", "New newsletter subscriber", email, email, JSON.stringify({ source: "newsletter_form" }), now).run();
        } catch (err) { console.error("[subscribe] D1 log failed:", err); }

        if (env.EMAIL) {
          try {
            await env.EMAIL.send({ to: email, from: { email: "noreply@cloudless.gr", name: "Cloudless" }, subject: "Welcome to Cloudless Newsletter", html: `<p>Thanks for subscribing! Check your inbox for updates.</p>`, text: "Thanks for subscribing to Cloudless!" });
          } catch (err) { console.error("[subscribe] Welcome email failed:", err); }
        }

        return jsonResponse({ success: true });
      }

      // POST /api/webhooks/stripe
      if (url.pathname === "/api/webhooks/stripe" && method === "POST") {
        const sig = request.headers.get("stripe-signature");
        if (env.STRIPE_WEBHOOK_SECRET && sig) {
          try {
            const body = await request.text();
            const event = JSON.parse(body);
            const now = Math.floor(Date.now() / 1000);
            await env.AUTH_DB.prepare("INSERT INTO stripe_transaction (event_id, event_type, customer_id, processing_status, received_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)").bind(event.id || `evt_${now}`, event.type || "unknown", event.data?.object?.customer || null, "processed", now, JSON.stringify(event)).run();
            return jsonResponse({ received: true });
          } catch (err) { console.error("[stripe-webhook] Processing failed:", err); return jsonResponse({ error: "Webhook processing failed" }, 500); }
        }
        return jsonResponse({ error: "Webhook not configured" }, 503);
      }

      // POST /api/checkout
      if (url.pathname === "/api/checkout" && method === "POST") {
        let parsed;
        try { parsed = await request.json(); } catch { return jsonResponse({ error: "Invalid request body" }, 400); }
        const { items = [], successUrl, cancelUrl } = parsed;
        if (!env.STRIPE_SECRET_KEY) { return jsonResponse({ error: "Checkout not configured" }, 503); }
        return jsonResponse({ url: successUrl || "https://cloudless.gr", sessionId: "cs_test_placeholder" });
      }

      // POST /api/csp-report
      if (url.pathname === "/api/csp-report" && method === "POST") {
        let payload;
        try { payload = await request.json(); } catch { return new Response(null, { status: 204, headers: corsHeaders() }); }

        if (Array.isArray(payload)) {
          for (const entry of payload) {
            if (entry?.type === "csp-violation") {
              const b = entry.body ?? {};
              console.warn(`[csp-violation] dir=${b.effectiveDirective || b["violated-directive"]} blocked=${b.blockedURL || b["blocked-uri"]} doc=${b.documentURL || b["document-uri"]} disp=${b.disposition}`);
            }
          }
        } else if (payload && typeof payload === "object" && "csp-report" in payload) {
          const r = (payload["csp-report"]) ?? {};
          console.warn(`[csp-violation] dir=${r["effective-directive"] || r["violated-directive"]} blocked=${r["blocked-uri"]} doc=${r["document-uri"]} disp=${r.disposition}`);
        }

        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      // GET /api/health
      if (url.pathname === "/api/health" && method === "GET") {
        let dbOk = false;
        try {
          const { results } = await env.AUTH_DB.prepare("SELECT 1 as ok").all();
          dbOk = results.length > 0 && results[0].ok === 1;
        } catch { dbOk = false; }

        const response = jsonResponse({ status: dbOk ? "ok" : "degraded", version: env.APP_VERSION || "1.0.0", authProvider: "d1", dbConnected: dbOk, timestamp: new Date().toISOString() });
        const headers = new Headers(response.headers);
        addSecurityHeaders(headers);
        return new Response(response.body, { status: response.status, headers });
      }

      // ==========================================
      // FALLBACK: Serve index.html for SPA routes
      // ==========================================
      const isProductionHost = host === "cloudless.gr" || host.endsWith(".cloudless.gr");
      const isPreviewHost = host.includes("cloudless-gr-preview") || host.includes("workers.dev");
      if (isProductionHost || isPreviewHost) {
        const normalizedPath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
        const asset = await env.ASSETS_BUCKET.get(normalizedPath);

        if (asset) {
          const headers = new Headers();
          asset.writeHttpMetadata(headers);
          headers.set("Cache-Control", "public, max-age=3600");
          Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
          return new Response(asset.body, { headers });
        }

        const indexAsset = await env.ASSETS_BUCKET.get("index.html");
        if (indexAsset) {
          const headers = new Headers();
          indexAsset.writeHttpMetadata(headers);
          Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
          return new Response(indexAsset.body, { headers });
        }
      }

      return new Response("Not found", { status: 404, headers: corsHeaders() });
    } catch (err) {
      console.error("[worker] Unhandled error:", err);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    console.log("Cron trigger fired at:", event.scheduledTime);
  },
};