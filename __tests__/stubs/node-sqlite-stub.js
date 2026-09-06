/* jshint esversion: 11, node: true */
// Stub for node:sqlite (Node.js 22+ built-in).
// Prevents Vite from failing to bundle it under JSDOM.
// Tests that need real sqlite behaviour must mock auth-db-local directly.
module.exports = {
  DatabaseSync: class {
    constructor() {}
    exec() {}
    prepare() {
      return { get: () => null, all: () => [], run: () => ({}) };
    }
    close() {}
  },
};
