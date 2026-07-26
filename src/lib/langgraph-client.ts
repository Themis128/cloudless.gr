/** * LangGraph Agent Server client stub
*
* This stub implementation is used when @langchain/langgraph-sdk is not installed.
* It provides the same API surface so routes don't crash, but throws runtime
* errors if actually called.
*/
export type { Thread, ThreadState, Run, Assistant };

class StubClient {
  constructor() {
    throw new Error("@langchain/langgraph-sdk is not installed in this environment");
  }

  // Implement all the methods that would normally exist on Client
  async search() {
    throw new Error("@langchain/langgraph-sdk is not installed in this environment");
  }

  async get() {
    throw new Error("@langchain/langgraph-sdk is not installed in this environment");
  }

  async create() {
    throw new Error("@langchain/langgraph-sdk is not installed in this environment");
  }

  async update() {
    throw new Error("@langchain/langgraph-sdk is not installed in this environment");
  }

  async delete() {
    throw new Error("@langchain/langgraph-sdk is not installed in this environment");
  }

  async getState() {
    throw new Error("@langchain/langgraph-sdk is not installed in this environment");
  }

  async updateState() {
    throw new Error("@langchain/langgraph-sdk is not installed in this environment");
  }

  async getHistory() {
    throw new Error("@langchain/langgraph-sdk is not installed in this environment");
  }

  async runs() {
    return {
      create: async () => {
        throw new Error("@langchain/langgraph-sdk is not installed in this environment");
      },
      cancel: async () => {
        throw new Error("@langchain/langgraph-sdk is not installed in this environment");
      },
      list: async () => {
        throw new Error("@langchain/langgraph-sdk is not installed in this environment");
      },
      get: async () => {
        throw new Error("@langchain/langgraph-sdk is not installed in this environment");
      },
      wait: async () => {
        throw new Error("@langchain/langgraph-sdk is not installed in this environment");
      },
    };
  }

  async store() {
    return {
      getItem: async () => {
        throw new Error("@langchain/langgraph-sdk is not installed in this environment");
      },
      putItem: async () => {
        throw new Error("@langchain/langgraph-sdk is not installed in this environment");
      },
      deleteItem: async () => {
        throw new Error("@langchain/langgraph-sdk is not installed in this environment");
      },
      searchItems: async () => {
        throw new Error("@langchain/langgraph-sdk is not installed in this environment");
      },
      listNamespaces: async () => {
        throw new Error("@langchain/langgraph-sdk is not installed in this environment");
      },
    };
  }
}

// Stubs for all exported functions
export async function getCloudlessAssistant(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function listAssistants(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function createLangGraphThread(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function getLangGraphThread(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function patchLangGraphThread(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function getLangGraphThreadState(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function updateLangGraphThreadState(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function deleteLangGraphThread(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function searchLangGraphThreads(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function getLangGraphThreadHistory(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export interface StreamRunOptions {
  streamMode?: ("messages" | "updates" | "values" | "events" | "debug" | "custom")[];
  interruptBefore?: string[] | "*";
  interruptAfter?: string[] | "*";
  onDisconnect?: "cancel" | "continue";
  multitaskStrategy?: "reject" | "rollback" | "interrupt" | "enqueue";
  ifNotExists?: "create" | "reject";
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
  command?: {
    update?: Record<string, unknown>;
    resume?: unknown;
    goto?: string | string[];
  };
}

export async function streamLangGraphRun(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function createBackgroundRun(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function joinRunStream(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function cancelRun(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function listRuns(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function getRun(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function invokeLangGraphRun(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function storeGet(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function storePut(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function storeDelete(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function storeSearch(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function storeListNamespaces(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}

export async function resumeInterruptedRun(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}