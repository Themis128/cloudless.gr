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
export function sanitizeLog(input: string, maxLength = 500): string {
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