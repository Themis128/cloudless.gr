/**
 * Detect offline/DNS failures when OpenNext tries to reach Cloudflare's API.
 * Uses URL hostname equality (not substring includes) for CodeQL js/incomplete-url-substring-sanitization.
 */
export function isCloudflareApiHostError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("EAI_AGAIN") || msg.includes("fetch failed")) {
    return true;
  }
  for (const match of msg.matchAll(/https?:\/\/[^\s)'"<>]+/gi)) {
    try {
      if (new URL(match[0]).hostname === "api.cloudflare.com") {
        return true;
      }
    } catch {
      // ignore unparseable fragments
    }
  }
  const cause = err instanceof Error ? err.cause : undefined;
  if (cause != null && cause !== err) {
    return isCloudflareApiHostError(cause);
  }
  return false;
}
