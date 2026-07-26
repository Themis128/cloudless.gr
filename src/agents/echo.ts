import { Agent } from "@cloudflare/agents";

// Env for agents - extends the generated Cloudflare.Env
// This provides the types needed for Agent<T> while staying compatible
type Env = Cloudflare.Env;

export type EchoState = {
  lastMessage: string;
  count: number;
};

export class EchoAgent extends Agent<Env, EchoState> {
  initialState: EchoState = {
    lastMessage: "",
    count: 0,
  };

  
  getState() {
    return {
      lastMessage: this.state?.lastMessage ?? "",
      count: this.state?.count ?? 0,
    };
  }

  
  echo(message: string) {
    const nextState = {
      lastMessage: message,
      count: (this.state?.count ?? 0) + 1,
    };

    this.setState(nextState);

    return nextState;
  }

  
  reset() {
    const nextState = {
      lastMessage: "",
      count: 0,
    };

    this.setState(nextState);

    return nextState;
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/status")) {
      return Response.json({
        ok: true,
        ...this.getState(),
      });
    }

    if (url.pathname.endsWith("/reset")) {
      return Response.json({
        ok: true,
        ...this.reset(),
      });
    }

    if (url.pathname.endsWith("/echo")) {
      const message = url.searchParams.get("message") ?? "hello";

      return Response.json({
        ok: true,
        ...this.echo(message),
      });
    }

    return Response.json({
      ok: true,
      agent: "EchoAgent",
      routes: {
        status: "/api/agents/echo-agent/default/status",
        echo: "/api/agents/echo-agent/default/echo?message=hello",
        reset: "/api/agents/echo-agent/default/reset",
      },
    });
  }
}