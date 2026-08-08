import { routeAgentRequest } from "agents";
import { CounterAgent } from "./agents/counter";
import { EchoAgent } from "./agents/echo";
import { CodingAgent } from "./agents/coding";

// Extend the generated Env with bindings that wrangler doesn't generate types for
// AGENT_AUTH_TOKEN is a secret, ASSETS is for static assets, CounterAgent is the DO namespace
// CHAT is optional - service binding to dedicated chat worker, CRON_SECRET for cron auth

interface ChatService {
  chatStream: (
    messages: { role: "user" | "assistant"; content: string }[],
    headers: Record<string, string>
  ) => Promise<ReadableStream<Uint8Array>>;
}

// Custom Env interface for this worker - extends base bindings with agent-specific ones
// AUTH_DB, CHAT, ADMIN_API, and CRON_SECRET are optional to support multiple deployment targets
interface Env {
  // Base bindings from wrangler.jsonc
  ASSETS_BUCKET: R2Bucket;
  MEDIA_BUCKET: R2Bucket;
  ANALYTICS_BUCKET: R2Bucket;
  DATALAKE_BUCKET: R2Bucket;
  AUTH_DB?: D1Database;
  EMAIL: SendEmail;
  ANALYTICS: AnalyticsEngineDataset;
  AI: Ai;
  ENVIRONMENT: "staging" | "production";
  API_VERSION: string;
  NEXT_PUBLIC_AUTH_PROVIDER: string;
  NEXT_PUBLIC_SITE_URL: string;
  APP_VERSION: string;
  SESSION_SECRET: string;
  // Custom bindings
  AGENT_AUTH_TOKEN: string;
  ASSETS: Fetcher;
  CounterAgent: DurableObjectNamespace<CounterAgent>;
  EchoAgent: DurableObjectNamespace<EchoAgent>;
  CodingAgent: DurableObjectNamespace<CodingAgent>;
  // OpenNext.js cache/queue bindings
  TAG_CACHE?: KVNamespace;
  REVALIDATION_QUEUE?: KVNamespace;
  // Service bindings (optional for development)
  CHAT?: ChatService;
  CRON_SECRET?: string;
}

// Re-export agents for Durable Object registration
export { CounterAgent } from "./agents/counter";
export type { CounterState } from "./agents/counter";
export { EchoAgent } from "./agents/echo";
export { CodingAgent } from "./agents/coding";

const AGENT_PATH_PREFIX = "/api/agents";
const DEFAULT_AGENT_PATH_PREFIX = "/agents";
const SERVER_COUNTER_PREFIX = "/api/server/counter";
const CHAT_PATH_PREFIX = "/api/chat";
const _LOCALES = ["en", "el", "fr", "de"];

// ---------------------------------------------------------------------------
// NOTE: Locale cascade and security headers are handled by src/proxy.ts
// to avoid duplication. The worker delegates to proxy via ASSETS.fetch.
// ---------------------------------------------------------------------------

function unauthorized() {
  return Response.json(
    {
      ok: false,
      error: "Unauthorized",
    },
    {
      status: 401,
      headers: {
        "www-authenticate": 'Bearer realm="CounterAgent"',
      },
    }
  );
}

function isAuthorized(request: Request, env: Env) {
  const expectedToken = env.AGENT_AUTH_TOKEN;

  if (!expectedToken) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const token = authorization.slice("Bearer ".length).trim();

  return token === expectedToken;
}

function rewriteAgentPrefix(request: Request) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith(AGENT_PATH_PREFIX + "/")) {
    return request;
  }

  url.pathname = DEFAULT_AGENT_PATH_PREFIX + url.pathname.slice(AGENT_PATH_PREFIX.length);

  return new Request(url.toString(), request);
}

async function handleServerCounterRoute(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  // /api/server/counter/:instance/:action
  const instanceName = parts[3] || "default";
  const action = parts[4] || "status";

  // Use getByName to get the stub with callable methods
  const counter = env.CounterAgent.getByName(instanceName);

  if (action === "status") {
    return Response.json({
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.getCount(),
    });
  }

  if (action === "increment") {
    return Response.json({
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.increment(),
    });
  }

  if (action === "decrement") {
    return Response.json({
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.decrement(),
    });
  }

  if (action === "reset") {
    return Response.json({
      ok: true,
      source: "server-code",
      instance: instanceName,
      count: await counter.reset(),
    });
  }

  return Response.json(
    {
      ok: false,
      error: "Unknown server counter action",
      instance: instanceName,
      action,
      routes: {
        status: "/api/server/counter/default/status",
        increment: "/api/server/counter/default/increment",
        decrement: "/api/server/counter/default/decrement",
        reset: "/api/server/counter/default/reset",
      },
    },
    {
      status: 404,
    }
  );
}

// ---------------------------------------------------------------------------
// CSP Report Endpoint
// ---------------------------------------------------------------------------

async function handleCspReport(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 204 });
  }

  // Handle modern Reporting-API payload (array format)
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      if (entry?.type === "csp-violation") {
        const b = (entry.body as Record<string, unknown>) ?? {};
        console.warn(
          `[csp-violation] dir=${b.effectiveDirective || b["violated-directive"] || "?"} ` +
            `blocked=${b.blockedURL || b["blocked-uri"] || "?"} ` +
            `doc=${b.documentURL || b["document-uri"] || "?"} ` +
            `disp=${b.disposition || "?"}`
        );
      }
    }
  } else if (payload && typeof payload === "object" && "csp-report" in payload) {
    // Handle legacy CSP-report format
    const r = ((payload as Record<string, unknown>)["csp-report"] as Record<string, unknown>) ?? {};
    console.warn(
      `[csp-violation] dir=${r["effective-directive"] || r["violated-directive"] || "?"} ` +
        `blocked=${r["blocked-uri"] || "?"} doc=${r["document-uri"] || "?"} disp=${r.disposition || "?"}`
    );
  }

  return new Response(null, { status: 204 });
}

async function handleChatRoute(request: Request, env: Env): Promise<Response> {
  // Check if CHAT service binding exists - if not, fall through to ASSETS
  if (!env.CHAT) {
    // Fall back to ASSETS fetch for Next.js route
    // Security headers are added by src/proxy.ts
    return await env.ASSETS.fetch(request);
  }

  try {
    // For RPC-style call, extract messages and call directly
    const body = (await request.json().catch(() => ({}))) as {
      messages?: { role: "user" | "assistant"; content: string }[];
    };

    // Build headers object for RPC context
    const headers = Object.fromEntries(request.headers.entries());

    // CHAT is WorkerEntrypoint from wrangler types
    // Call chatStream method with the appropriate signature
    const chatStub = env.CHAT as unknown as {
      chatStream: (
        messages: { role: "user" | "assistant"; content: string }[],
        headers: Record<string, string>
      ) => Promise<ReadableStream<Uint8Array>>;
    };
    const stream = await chatStub.chatStream(body.messages || [], headers);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    // If stream fails, try regular fetch as fallback
    if (err instanceof Error && err.message.includes("Rate limit")) {
      return Response.json({ error: err.message }, { status: 429 });
    }
    // Fall back to ASSETS fetch for Next.js route
    // Security headers are added by src/proxy.ts
    return await env.ASSETS.fetch(request);
  }
}

// ---------------------------------------------------------------------------
// Cron Route Handler (Workers environment)
// ---------------------------------------------------------------------------

async function handleCronRoute(env: Env): Promise<Response | null> {
  // Detect if this is a cron trigger (SST Cron sets CRON_ROUTE in env)
  const cronRoute = process.env.CRON_ROUTE;

  if (!cronRoute) {
    return null;
  }

  // Verify CRON_SECRET is available
  if (!env.CRON_SECRET) {
    console.error("[cron] CRON_SECRET not configured - cron jobs disabled");
    return new Response("Unauthorized", { status: 401 });
  }

  // Create internal POST request to the cron endpoint
  const internalRequest = new Request(`https://internal${cronRoute}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      "x-cron-internal": "true",
    },
  });

  // Route to the appropriate API endpoint via ASSETS
  // The cron API routes are handled by Next.js /api/cron/* endpoints
  // Security headers are added by src/proxy.ts
  return await env.ASSETS.fetch(internalRequest);
}

const worker = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle SST Cron triggers first (before any other routing)
    // SST Cron invokes fetch() directly with CRON_ROUTE env var set
    const isCronTrigger = !!process.env.CRON_ROUTE;
    if (isCronTrigger) {
      const cronResponse = await handleCronRoute(env);
      if (cronResponse) {
        return cronResponse;
      }
    }

    const isCustomAgentRoute = url.pathname.startsWith(AGENT_PATH_PREFIX + "/");
    const isDefaultAgentRoute = url.pathname.startsWith(DEFAULT_AGENT_PATH_PREFIX + "/");
    const isServerCounterRoute = url.pathname.startsWith(SERVER_COUNTER_PREFIX + "/");
    const isChatRoute =
      url.pathname.startsWith(CHAT_PATH_PREFIX + "/") || url.pathname === CHAT_PATH_PREFIX;
    const isCspReport = url.pathname === "/api/csp-report" && request.method === "POST";

    if ((isCustomAgentRoute || isServerCounterRoute) && !isAuthorized(request, env)) {
      return unauthorized();
    }

    // CSP report endpoint
    if (isCspReport) {
      return await handleCspReport(request);
    }

    // Route chat to dedicated service worker via RPC binding
    if (isChatRoute) {
      return handleChatRoute(request, env);
    }

    if (isServerCounterRoute) {
      const response = await handleServerCounterRoute(request, env);
      return response;
    }

    if (isDefaultAgentRoute) {
      return Response.json(
        {
          ok: false,
          error: "Use custom Agent path prefix",
          pathPrefix: AGENT_PATH_PREFIX,
        },
        {
          status: 404,
        }
      );
    }

    const routedRequest = rewriteAgentPrefix(request);
    const agentResponse = await routeAgentRequest(routedRequest, env);

    if (agentResponse) {
      return agentResponse;
    }

    // ==========================================
    // SECURITY: Reject unauthenticated admin API requests
    // ==========================================
    const isAdminApi = url.pathname.startsWith("/api/admin");
    const isAuthApi = url.pathname.startsWith("/api/auth") || url.pathname === "/api/auth/session";

    if (isAdminApi && !isAuthApi) {
      // Check for valid session cookie or Bearer token
      const sessionId = request.headers.get("Cookie")?.match(/session_token=([^;]+)/)?.[1];
      const authHeader = request.headers.get("Authorization");
      const hasValidAuth =
        sessionId || (authHeader?.startsWith("Bearer ") && authHeader.slice(7).trim());

      if (!hasValidAuth) {
        return Response.json({ error: "Authentication required" }, { status: 401 });
      }
    }

    // ==========================================
    // HEALTH ENDPOINT
    // ==========================================
    if (url.pathname === "/api/health" && request.method === "GET") {
      let dbOk: boolean = false;
      try {
        const result = await env.AUTH_DB?.prepare("SELECT 1 as ok").all();
        dbOk = !!(
          result &&
          result.results &&
          result.results.length > 0 &&
          (result.results[0] as { ok?: number })?.ok === 1
        );
      } catch {
        dbOk = false;
      }
      return Response.json({
        status: dbOk ? "ok" : "degraded",
        version: process.env.APP_VERSION || "1.0.0",
        authProvider: "d1",
        dbConnected: dbOk,
        timestamp: new Date().toISOString(),
      });
    }

    // Fallback to ASSETS fetch for all other requests
    // Security headers are added by src/proxy.ts, not here
    const response = await env.ASSETS.fetch(request);
    return new Response(response.body, { ...response, headers: response.headers });
  },
};

export default worker;
