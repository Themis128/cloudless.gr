/**
 * Pure input validators for the cloudless-infra MCP write tools.
 *
 * Extracted into their own module so the root vitest suite can cover them
 * without importing index.ts (which starts an MCP stdio server on import).
 */

/** GitHub Actions secret names must be uppercase A-Z plus digits and underscores. */
export function isValidSecretName(name: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(name);
}

/** Plain base64 — no whitespace, no URL-safe variants. Matches `base64 -w0` output. */
export function isPlainBase64(s: string): boolean {
  if (s.length === 0) return false;
  return /^[A-Za-z0-9+/=]+$/.test(s);
}

/**
 * Refuse anything that doesn't look like an agent-authored topic branch.
 * Keeps the patch-apply tool from ever pushing to a release/protected branch.
 */
export function isClaudeBranch(name: string): boolean {
  return /^claude\/[a-z0-9][a-z0-9._-]*$/i.test(name);
}

/**
 * Resolve a short SSM name to the full `/cloudless/production/X` path.
 * Pass-through if the user already gave an absolute path.
 */
export function resolveSsmName(name: string): string {
  return name.startsWith("/") ? name : `/cloudless/production/${name}`;
}
