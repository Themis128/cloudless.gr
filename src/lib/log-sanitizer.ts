/**
 * Log Sanitization Utilities for Security
 *
 * Prevents log injection attacks by removing control characters and format specifiers.
 * Format strings in console methods can be exploited when user-controlled data contains
 * %s, %d, %i, %o, etc.
 */

/**
 * Sanitize a string for safe logging.
 * - Removes control characters (including newlines, tabs, null bytes)
 * - Removes format specifiers (%s, %d, %i, %o, etc.) that could be interpreted by loggers
 * - Truncates to reasonable length to prevent log flooding
 */
    /**
     * Pattern matching for sensitive information:
     * - API keys (generic)
     * - AWS keys
     * - Google keys
     * - Slack tokens
     * - Passwords
     * - Email addresses
     */
    const SENSITIVE_PATTERNS = [
      /api_?key\s*[:=]\s*[\w-]{32,}/gi,
      /aws_?access_key_id\s*[:=]\s*[a-zA-Z0-9]{16,20}/gi,
      /aws_?secret_access_key\s*[:=]\s*[a-zA-Z0-9/+=]{40}/gi,
      /google_?api_?key\s*[:=]\s*[a-zA-Z0-9_-]{32,}/gi,
      /xox[pb]-[a-zA-Z0-9]{10,}/gi,
      /password\s*[:=]\s*[^\s]{6,}/gi,
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
    ];

    export function sanitizeLog(input: string, maxLength = 500): string {
      return input
        // First mask sensitive patterns
        .replace(SENSITIVE_PATTERNS, (match) => `[REDACTED:${match.length}]`)
        // Then remove control characters and format specifiers
        .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
        .replace(/%/g, "") // Remove format specifier marker
        .replace(/\r?\n/g, " ") // Replace newlines with spaces
        .slice(0, maxLength);
  return input
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .replace(/%/g, "") // Remove format specifier marker
    .replace(/\r?\n/g, " ") // Replace newlines with spaces
    .slice(0, maxLength);
}

/**
 * Sanitize error for logging by extracting and sanitizing the message.
 */
export function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return sanitizeLog(msg);
}
