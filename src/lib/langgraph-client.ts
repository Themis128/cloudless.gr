/**
 * LangGraph Agent Server client stub
 *
 * This stub implementation is used when @langchain/langgraph-sdk is not installed.
 * It provides the same API surface so routes don't crash, but throws runtime
 * errors if actually called.
 */
export type { Thread, ThreadState, Run, Assistant } from "@langchain/langgraph-sdk";

export interface StreamRunOptions {
  streamMode?: ("messages" | "updates" | "values" | "events" | "debug" | "custom")[];
  interruptBefore?: string[] | "*";
  interruptAfter?: string[] | "*";
  onDisconnect?: "cancel" | "continue";
  multitaskStrategy?: "reject" | "rollback" | "interrupt" | "enqueue";
  ifNotExists?: "create" | "reject";
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
  command?: { update?: Record<string, unknown>; resume?: unknown; goto?: string | string[] };
}
export async function getCloudlessAssistant(): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function listAssistants(_graphId?: string): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function createLangGraphThread(_metadata?: Record<string, unknown>): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function getLangGraphThread(_tid?: string): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function patchLangGraphThread(
  _tid?: string,
  _metadata?: Record<string, unknown>
): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function getLangGraphThreadState(_tid?: string): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function updateLangGraphThreadState(
  _tid?: string,
  _values?: Record<string, unknown>,
  _asNode?: string
): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function deleteLangGraphThread(_tid?: string): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function searchLangGraphThreads(
  _limit?: number,
  _metadata?: Record<string, unknown>,
  _status?: "idle" | "busy" | "interrupted" | "error"
): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function getLangGraphThreadHistory(_tid?: string, _limit?: number): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function streamLangGraphRun(
  _threadId?: string,
  _assistantId?: string,
  _messages?: Array<Record<string, unknown>>,
  _opts?: StreamRunOptions
): Promise<Response> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function createBackgroundRun(
  _threadId?: string,
  _assistantId?: string,
  _messages?: Array<Record<string, unknown>>,
  _opts?: Record<string, unknown>
): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function joinRunStream(_threadId?: string, _runId?: string): Promise<Response> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function cancelRun(
  _threadId?: string,
  _runId?: string,
  _wait?: boolean
): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function listRuns(_threadId?: string, _limit?: number): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function getRun(_threadId?: string, _runId?: string): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function invokeLangGraphRun(
  _threadId?: string,
  _assistantId?: string,
  _messages?: Array<Record<string, unknown>>,
  _config?: Record<string, unknown>
): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function storeGet(_namespace?: string[], _key?: string): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function storePut(
  _namespace?: string[],
  _key?: string,
  _value?: Record<string, unknown>
): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function storeDelete(_namespace?: string[], _key?: string): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function storeSearch(
  _namespacePrefix?: string[],
  _opts?: { query?: string; limit?: number; filter?: Record<string, unknown> }
): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function storeListNamespaces(
  _prefix?: string | string[],
  _suffix?: string | string[]
): Promise<never> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
export async function resumeInterruptedRun(
  _threadId?: string,
  _assistantId?: string,
  _resumeValue?: unknown,
  _streamMode?: StreamRunOptions["streamMode"]
): Promise<Response> {
  throw new Error("@langchain/langgraph-sdk is not installed in this environment");
}
