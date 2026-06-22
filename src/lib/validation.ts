/**
 * Shared validation utilities for API routes.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_LENGTH = 254;

/**
 * Validates an email address format and length.
 */
export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= EMAIL_MAX_LENGTH && EMAIL_REGEX.test(email);
}
