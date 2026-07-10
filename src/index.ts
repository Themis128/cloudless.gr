import { getAgentByName, routeAgentRequest } from "agents";
import { CounterAgent } from "./agents/counter";
import { setEmailBinding } from "./lib/email-sender";

export { CounterAgent };
export { EchoAgent } from "./agents/echo";
export { CodingAgent } from "./agents/coding";

const AGENT_PATH_PREFIX = "/api/agents";
const DEFAULT_AGENT_PATH_PREFIX = "/agents";
const SERVER_COUNTER_PREFIX = "/api/server/counter";

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

  if (!env.CounterAgent) {
    return Response.json({ ok: false, error: "CounterAgent not configured" }, { status: 500 });
  }

  const counter = await getAgentByName(env.CounterAgent, instanceName);

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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Inject Cloudflare Email binding for the unified email sender
    if (env.EMAIL) {
      setEmailBinding(env.EMAIL);
      (globalThis as any).__EMAIL_BINDING__ = env.EMAIL;
    }

    const url = new URL(request.url);

    const isCustomAgentRoute = url.pathname.startsWith(AGENT_PATH_PREFIX + "/");
    const isDefaultAgentRoute = url.pathname.startsWith(DEFAULT_AGENT_PATH_PREFIX + "/");
    const isServerCounterRoute = url.pathname.startsWith(SERVER_COUNTER_PREFIX + "/");

    // Public demo route - no auth required
    const isPublicDemo = url.pathname.startsWith("/api/agents/counter-agent/default");
    if ((isCustomAgentRoute || isServerCounterRoute) && !isPublicDemo && !isAuthorized(request, env)) {
      return unauthorized();
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

    // Worker doesn't serve static assets - return 404 for unmatched routes
    return new Response("Not found", { status: 404 });
  },
};
