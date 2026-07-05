"use client";

import { useAgent } from "agents/react";
import { useState } from "react";
import type { CounterAgent, CounterState } from "../agents/counter";

export function CounterAgentWidget() {
  const [count, setCount] = useState(0);

  const agent = useAgent<CounterAgent, CounterState>({
    agent: "CounterAgent",
    name: "default",
    onStateUpdate: (state) => {
      setCount(state.count);
    },
  });

  return (
    <section>
      <h2>CounterAgent</h2>

      <p>
        Count: <strong>{count}</strong>
      </p>

      <button onClick={() => agent.stub.increment()}>
        Increment
      </button>

      <button onClick={() => agent.stub.decrement()}>
        Decrement
      </button>

      <button onClick={() => agent.stub.reset()}>
        Reset
      </button>
    </section>
  );
}
