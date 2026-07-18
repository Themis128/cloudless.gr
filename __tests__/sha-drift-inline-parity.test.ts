/**
 * scripts/detect-sha-drift.mts intentionally duplicates the pure
 * comparison logic from src/lib/sha-drift.ts (see the docstring there
 * for why — tsx-in-CI has been brittle with cross-module imports).
 *
 * This test pins the two copies in sync at the source level: if the
 * lib changes, the inline copy must change to match, otherwise CI
 * flags the divergence here instead of letting drift detection
 * silently misbehave.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LIB = readFileSync(resolve(__dirname, "../src/lib/sha-drift.ts"), "utf-8");
const SCRIPT = readFileSync(resolve(__dirname, "../scripts/detect-sha-drift.mts"), "utf-8");

/** Strip leading `export ` so the two declarations compare equal. */
function stripExport(s: string): string {
  return s.replace(/^export\s+/gm, "");
}

/** Strip line and block comments — they're commentary, not behavior. */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Collapse whitespace so trivial reformatting doesn't break parity. */
function normalize(s: string): string {
  return stripComments(stripExport(s)).replace(/\s+/g, " ").trim();
}

/**
 * Extract the body of a top-level declaration by name. Supports
 * `function`, `const`, and `interface` forms used in sha-drift.ts.
 * Returns `null` if not found.
 */
function extractDecl(source: string, name: string): string | null {
  // For functions, match until we find "return { ... }; }" pattern
  // which ends the function before the next top-level declaration
  const patterns = [
    // Functions - match until return statement followed by closing brace and newline
    new RegExp(`(?:export\\s+)?function\\s+${name}\\b[\\s\\S]*?return \\{[\\s\\S]*?;\\s*\\}`, "m"),
    // Const - match until semicolon
    new RegExp(`(?:export\\s+)?const\\s+${name}\\b[^;]*;`),
    // Interface - match until closing brace followed by newline
    new RegExp(`(?:export\\s+)?interface\\s+${name}\\b[\\s\\S]*?^\\}`, "m"),
  ];
  for (const re of patterns) {
    const m = source.match(re);
    if (m) return m[0].trim();
  }
  return null;
}

const PINNED = [
  "DriftSnapshot",
  "SurfaceStatus",
  "DriftReport",
  "GRACE_WINDOW_MS",
  "shaEquivalent",
  "classifySurface",
  "evaluateDrift",
] as const;

describe("sha-drift inline parity", () => {
  for (const name of PINNED) {
    it(`${name} matches between lib and inline script`, () => {
      const libDecl = extractDecl(LIB, name);
      const scriptDecl = extractDecl(SCRIPT, name);
      expect(libDecl, `missing ${name} in src/lib/sha-drift.ts`).toBeTruthy();
      expect(scriptDecl, `missing ${name} in scripts/detect-sha-drift.mts`).toBeTruthy();
      expect(normalize(scriptDecl!)).toBe(normalize(libDecl!));
    });
  }
});
