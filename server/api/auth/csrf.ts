// API endpoint to generate CSRF token
import { defineEventHandler, setCookie } from 'h3';
import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrf_token';

export default defineEventHandler((event) => {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');

  // Set CSRF token in a cookie
  setCookie(event, CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    sameSite: 'strict',
  });

  return {
    token,
    message: 'CSRF token generated',
  };
});
