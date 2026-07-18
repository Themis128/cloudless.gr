import { routeAgentRequest } from "agents";
import { CounterAgent } from "./agents/counter";
import type { CounterState } from "./agents/counter";

// Extend the generated Env with bindings that wrangler doesn't generate types for
// AGENT_AUTH_TOKEN is a secret, ASSETS is for static assets, CounterAgent is the DO namespace
// CHAT is optional - service binding to dedicated chat worker

interface ChatService {
  chatStream: (messages: { role: "user" | "assistant"; content: string }[], headers: Record<string, string>) => Promise<ReadableStream<Uint8Array>>;
}

interface Env extends Cloudflare.Env {
  AGENT_AUTH_TOKEN: string;
  ASSETS: Fetcher;
  CounterAgent: DurableObjectNamespace<CounterAgent>;
  CHAT?: ChatService;
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
const LOCALES = ["en", "el", "fr", "de"];

// ---------------------------------------------------------------------------
// Locale cascade fix: handle /en/en/en/... paths and redirect properly
// ---------------------------------------------------------------------------

function fixLocaleCascade(url: URL): Response | null {
  const path = url.pathname;
  
  // Check for locale cascade: multiple consecutive locale prefixes (e.g., /en/en/en/...)
  const localePattern = new RegExp(`^/(${LOCALES.join("|")})/(${LOCALES.join("|")})/(${LOCALES.join("|")}/)+`);
  
  if (localePattern.test(path)) {
    // Extract the actual path after removing duplicate locale prefixes
    // e.g., /en/en/en/blog -> /blog
    let cleanPath = path.replace(localePattern, "/");
    // Handle case like /en/en/en (no trailing path) -> redirect to /en
    if (cleanPath === "/" && path !== "/") {
      cleanPath = "/en";
    }
    
    // Preserve query string
    const cleanUrl = cleanPath === "/" ? 
      (url.search ? `${cleanPath}?${url.search}` : cleanPath) : 
      (url.search ? `${cleanPath}?${url.search}` : cleanPath);
    
    return Response.redirect(`${url.origin}${cleanPath}`, 301);
  }
  
  return null;
}

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
// Chat service routing - delegates to cloudless-gr-chat via service binding
// ---------------------------------------------------------------------------

async function handleChatRoute(request: Request, env: Env): Promise<Response> {
  try {
    // For RPC-style call, extract messages and call directly
    const body = (await request.json().catch(() => ({}))) as { messages?: { role: "user" | "assistant"; content: string }[] };

    // Build headers object for RPC context
    const headers = Object.fromEntries(request.headers.entries());

    // CHAT is WorkerEntrypoint from wrangler types
    // Call chatStream method with the appropriate signature
    const chatStub = env.CHAT as unknown as {
      chatStream: (messages: { role: "user" | "assistant"; content: string }[], headers: Record<string, string>) => Promise<ReadableStream<Uint8Array>>;
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
    return env.ASSETS.fetch(request);
  }
}

const worker = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle locale cascade redirects first
    const localeRedirect = fixLocaleCascade(url);
    if (localeRedirect) {
      return localeRedirect;
    }

    const isCustomAgentRoute = url.pathname.startsWith(AGENT_PATH_PREFIX + "/");
    const isDefaultAgentRoute = url.pathname.startsWith(DEFAULT_AGENT_PATH_PREFIX + "/");
    const isServerCounterRoute = url.pathname.startsWith(SERVER_COUNTER_PREFIX + "/");
    const isChatRoute = url.pathname.startsWith(CHAT_PATH_PREFIX + "/") || url.pathname === CHAT_PATH_PREFIX;

    if ((isCustomAgentRoute || isServerCounterRoute) && !isAuthorized(request, env)) {
      return unauthorized();
    }

    // Route chat to dedicated service worker via RPC binding
    if (isChatRoute) {
      return handleChatRoute(request, env);
    }

    if (isServerCounterRoute) {
      return handleServerCounterRoute(request, env);
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

    return env.ASSETS.fetch(request);
  },
};


export default worker;