import crypto from 'crypto';

const CSRF_SECRET = process.env.NUXT_CSRF_SECRET || 'default-csrf-secret-change-in-production';

/**
 * Generate a CSRF token for a given session ID
 * @param sessionId - Unique session identifier
 * @returns CSRF token string
 */
export function generateCsrfToken(sessionId: string): string {
  const timestamp = Date.now().toString();
  const data = `${sessionId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(data);
  const signature = hmac.digest('hex');
  return `${timestamp}.${signature}`;
}

/**
 * Verify a CSRF token for a given session ID
 * @param token - CSRF token to verify
 * @param sessionId - Session ID to verify against
 * @param maxAge - Maximum age of token in milliseconds (default: 4 hours)
 * @returns true if valid, false otherwise
 */
export function verifyCsrfToken(
  token: string,
  sessionId: string,
  maxAge: number = 4 * 60 * 60 * 1000
): boolean {
  try {
    const [timestamp, signature] = token.split('.');
    if (!timestamp || !signature) {
      return false;
    }

    // Check if token is expired
    const tokenTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (now - tokenTime > maxAge) {
      return false;
    }

    // Verify signature
    const data = `${sessionId}:${timestamp}`;
    const hmac = crypto.createHmac('sha256', CSRF_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('CSRF token verification error:', error);
    return false;
  }
}

/**
 * Create a safe comparison function to prevent timing attacks
 * @param a - First buffer
 * @param b - Second buffer
 * @returns true if buffers are equal
 */
export function safeCompare(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
