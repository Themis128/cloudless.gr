// API endpoint for user logout
import { defineEventHandler, setCookie } from 'h3';

const COOKIE_NAME = 'auth_token';

export default defineEventHandler(async (event) => {
  // Clear the auth cookie
  setCookie(event, COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0, // Expired immediately
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  return {
    success: true,
    message: 'Logged out successfully',
  };
});
