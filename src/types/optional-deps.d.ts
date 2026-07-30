/** Ambient types for optional runtime dependencies not listed in package.json. */

declare module "@duckdb/duckdb-wasm" {
  export enum LogLevel {
    WARNING = 3,
  }

  export class ConsoleLogger {
    constructor(level: LogLevel);
  }

  export class AsyncDuckDB {
    constructor(logger: ConsoleLogger);
    instantiate(workerUrl: string): Promise<void>;
  }
}
