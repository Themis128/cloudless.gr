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

declare module "@aws-sdk/client-sns" {
  export class SNSClient {
    constructor(config?: { region?: string });
    send(command: PublishCommand): Promise<unknown>;
  }

  export class PublishCommand {
    constructor(input: {
      TopicArn: string;
      Subject?: string;
      Message: string;
      MessageAttributes?: Record<string, { DataType: string; StringValue: string }>;
    });
  }
}
