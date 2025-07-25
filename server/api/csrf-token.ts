import { defineEventHandler, setCookie } from 'h3';
import { generateCsrfToken } from '../utils/csrf-protection';

/**
 * API endpoint to generate and return a CSRF token
 * Sets the token in a cookie and returns it in the response
 */
export default defineEventHandler((event) => {
  // Generate a unique session ID (in a real app, you'd use a proper session ID)
  // For simplicity, we're using a combination of timestamp and random string
  const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  // Generate a CSRF token
  const csrfToken = generateCsrfToken(sessionId);
  // Set the token in a cookie
  setCookie(event, 'csrf_token', csrfToken, {
    httpOnly: true, // Cannot be accessed by JavaScript
    path: '/', // Available across the site
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    maxAge: 14400, // 4 hours (in seconds)
    sameSite: 'lax', // Allow cross-site requests in some cases
  });

  // Return the token to be included in the form
  return {
    token: csrfToken,
  };
});
