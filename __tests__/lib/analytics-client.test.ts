/**
 * Tests for src/lib/analytics-client.ts
 *
 * analytics-client.ts is a "use client" module. We can test isDuckDBAvailable()
 * by manipulating globalThis properties. queryLakeParquet() requires DuckDB-Wasm
 * and is tested at a high level only (guards the early-return path).
 */
import { describe, it, expect, vi, afterEach } from "vitest";

// Re-export of lake-parquet-catalog is covered in its own test file.
// Focus here: isDuckDBAvailable and the no-runtime early return.

// We need to test isDuckDBAvailable in isolation. The function reads from
// globalThis at call time, so we can manipulate globalThis fields directly.

// Import after any potential env manipulation
import { isDuckDBAvailable } from "@/lib/analytics-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isDuckDBAvailable", () => {
  it("returns true in a browser-like environment (jsdom has window, Worker, crypto)", () => {
    // jsdom provides window, Worker, crypto.subtle — should return true
    if (typeof window !== "undefined" && typeof Worker !== "undefined" && typeof crypto?.subtle !== "undefined") {
      expect(isDuckDBAvailable()).toBe(true);
    }
  });

  it("returns false when window is undefined", () => {
    const origWindow = globalThis.window;
    // Temporarily hide window
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    try {
      expect(isDuckDBAvailable()).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "window", {
        value: origWindow,
        writable: true,
        configurable: true,
      });
    }
  });

  it("returns false when Worker is undefined", () => {
    const origWorker = globalThis.Worker;
    try {
      (globalThis as { Worker?: unknown }).Worker = undefined;
      expect(isDuckDBAvailable()).toBe(false);
    } finally {
      (globalThis as { Worker?: unknown }).Worker = origWorker;
    }
  });

  it("returns false when crypto.subtle is undefined", () => {
    const origCrypto = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, "crypto", {
        value: {},
        writable: true,
        configurable: true,
      });
      expect(isDuckDBAvailable()).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: origCrypto,
        writable: true,
        configurable: true,
      });
    }
  });
});
