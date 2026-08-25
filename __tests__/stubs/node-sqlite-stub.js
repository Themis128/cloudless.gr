/**
 * Mock for node:sqlite — used in tests running in jsdom environment
 * where node:sqlite is not available.
 * Tests that need real sqlite should use @vitest-environment node.
 */

export class DatabaseSync {
  constructor() {}

  exec() {}

  prepare() {
    return {
      bind: function() { return this; },
      all: async () => ({ results: [], success: true }),
      run: async () => ({ success: true, meta: { changes: 0 } }),
      first: async () => ({ ok: 1n }),
      get: () => undefined,
    };
  }

  close() {}
}

export const Session = class {};

export const StatementSync = class {};

export const backup = () => {};

export const constants = {};

export default {
  DatabaseSync,
  Session,
  StatementSync,
  backup,
  constants,
};