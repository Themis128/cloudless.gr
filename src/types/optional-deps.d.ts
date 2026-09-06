/* eslint-disable no-unused-vars */
/** Ambient types for optional runtime dependencies not listed in package.json. */

declare module "@duckdb/duckdb-wasm" {
  export enum LogLevel {
    WARNING = 3,
  }

  export class ConsoleLogger {
    constructor(level?: LogLevel | number);
  }

  export class AsyncDuckDB {
    constructor(logger: ConsoleLogger | unknown, worker?: Worker);
    instantiate(mainModule: string, pthreadWorker?: string | null): Promise<void>;
    registerFileBuffer(name: string, buffer: Uint8Array): Promise<void>;
    connect(): Promise<{
      query: (sql: string) => Promise<{ toArray: () => Record<string, unknown>[] }>;
      close: () => Promise<void>;
    }>;
  }

  export function getJsDelivrBundles(): unknown;
  export function selectBundle(bundles: unknown): Promise<{
    mainWorker?: string;
    mainModule: string;
    pthreadWorker?: string;
  }>;
}
