import { D1Database } from '@cloudflare/workers-types';

export class MockD1Database implements Partial<D1Database> {
  private shouldFail: boolean = false;
  private failOnQuery: string | null = null;
  private failWithError: Error | null = null;

  constructor() {
    this.reset();
  }

  reset() {
    this.shouldFail = false;
    this.failOnQuery = null;
    this.failWithError = null;
  }

  configureFailure(
    options: {
      failOnQuery?: string;
      failWithError?: Error;
    } = {}
  ) {
    this.shouldFail = true;
    this.failOnQuery = options.failOnQuery;
    this.failWithError = options.failWithError || new Error('Database error');
  }

  prepare(query: string) {
    if (this.shouldFail && (!this.failOnQuery || query.includes(this.failOnQuery))) {
      throw this.failWithError!;
    }

    // Return a mock D1PreparedStatement that implements the interface
    const mockStatement = {
      bind: (...args: unknown[]) => {
        // Return self to allow chaining
        return mockStatement;
      },
      all: async <T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> => {
        return { results: [], success: true };
      },
      run: async (): Promise<{ success: boolean; meta?: { changes: number } }> => {
        return { success: true };
      },
      first: async <T = Record<string, unknown>>(col?: string): Promise<T | null> => {
        return null;
      }
    };

    return mockStatement;
  }
}