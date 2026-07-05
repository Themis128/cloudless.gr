import { Agent, callable } from "agents";

export type CounterState = {
  count: number;
};

export class CounterAgent extends Agent<Env, CounterState> {
  initialState: CounterState = {
    count: 0,
  };

  @callable()
  getCount() {
    return this.state?.count ?? 0;
  }

  @callable()
  increment() {
    const nextCount = (this.state?.count ?? 0) + 1;

    this.setState({
      count: nextCount,
    });

    return nextCount;
  }

  @callable()
  decrement() {
    const nextCount = Math.max(0, (this.state?.count ?? 0) - 1);

    this.setState({
      count: nextCount,
    });

    return nextCount;
  }

  @callable()
  reset() {
    this.setState({
      count: 0,
    });

    return 0;
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/status")) {
      return Response.json({
        ok: true,
        count: this.getCount(),
      });
    }

    if (url.pathname.endsWith("/increment")) {
      return Response.json({
        ok: true,
        count: this.increment(),
      });
    }

    if (url.pathname.endsWith("/decrement")) {
      return Response.json({
        ok: true,
        count: this.decrement(),
      });
    }

    if (url.pathname.endsWith("/reset")) {
      return Response.json({
        ok: true,
        count: this.reset(),
      });
    }

    return Response.json({
      ok: true,
      agent: "CounterAgent",
      routes: {
        status: "/api/agents/counter-agent/default/status",
        increment: "/api/agents/counter-agent/default/increment",
        decrement: "/api/agents/counter-agent/default/decrement",
        reset: "/api/agents/counter-agent/default/reset",
      },
    });
  }
}
