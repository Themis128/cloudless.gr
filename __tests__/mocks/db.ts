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

  async prepare(query: string) {
    if (this.shouldFail && (!this.failOnQuery || query.includes(this.failOnQuery!))) {
      throw this.failWithError!;
    }

    return {
      bind: () => ({
        first: async () => ({}),
        all: async () => [],
        run: async () => ({})
      })
    };
  }
}