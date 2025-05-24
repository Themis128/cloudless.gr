/**
 * CSRF token management utility
 * Provides functions to generate and validate CSRF tokens for form submissions
 */

import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Secret for CSRF token generation (in a real app, this should be in environment variables)
const CSRF_SECRET = process.env.CSRF_SECRET || 'cloudless-contact-form-secret';

// Map to store issued tokens and their expiration times
const tokenStore = new Map<string, number>();

// Token validity duration (4 hours)
const TOKEN_VALIDITY_MS = 14400000; // Increased from 1 hour to 4 hours

// Path for persistent token storage
const TOKENS_FILE_PATH = resolve(process.cwd(), 'data', 'csrf-tokens.json');

// Load tokens from persistent storage on startup
try {
  if (existsSync(TOKENS_FILE_PATH)) {
    const tokensData = readFileSync(TOKENS_FILE_PATH, 'utf-8');
    const tokens = JSON.parse(tokensData);

    // Restore tokens to memory
    Object.entries(tokens).forEach(([token, expiration]) => {
      tokenStore.set(token, expiration as number);
    });

    console.log(`Loaded ${tokenStore.size} CSRF tokens from persistent storage`);

    // Clean up expired tokens immediately
    cleanExpiredTokens();
  }
} catch (error) {
  console.error('Error loading CSRF tokens from persistent storage:', error);
}

// Save tokens to persistent storage periodically
const saveTokensToDisk = () => {
  try {
    // Ensure directory exists
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(TOKENS_FILE_PATH);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory for CSRF tokens: ${dir}`);
    }

    const tokens = Object.fromEntries(tokenStore.entries());
    writeFileSync(TOKENS_FILE_PATH, JSON.stringify(tokens), 'utf-8');
    console.log(`Saved ${tokenStore.size} CSRF tokens to disk`);
  } catch (error) {
    console.error('Error saving CSRF tokens to persistent storage:', error);
  }
};

// Set up periodic saving (every 5 minutes)
if (process.env.NODE_ENV === 'production') {
  setInterval(saveTokensToDisk, 300000); // 5 minutes
}

/**
 * Generate a new CSRF token for a session
 * @param sessionId Unique identifier for the user session
 * @returns The generated CSRF token
 */
export function generateCsrfToken(sessionId: string): string {
  // Clean up expired tokens first
  cleanExpiredTokens();

  // Generate a token using timestamp and session ID
  const timestamp = Date.now();
  const tokenBase = `${sessionId}-${timestamp}-${CSRF_SECRET}`;

  // Use crypto module if available for more secure hashing
  let token;
  try {
    // Try using a more secure hashing method
    token = createHash('sha256').update(tokenBase).digest('base64');
  } catch (error) {
    // Fall back to basic encoding if crypto is not available
    console.warn('Crypto module not available, using fallback token generation');
    token = Buffer.from(tokenBase).toString('base64');
  }

  // Store the token with its expiration time
  tokenStore.set(token, timestamp + TOKEN_VALIDITY_MS);

  // Log token creation (timestamp only for security)
  console.log(`CSRF token created, expires in ${TOKEN_VALIDITY_MS / 1000 / 60} minutes`);

  // Save to disk in production
  if (process.env.NODE_ENV === 'production') {
    saveTokensToDisk();
  }

  return token;
}

/**
 * Validate a CSRF token
 * @param token The token to validate
 * @returns Boolean indicating if the token is valid
 */
export function validateCsrfToken(token: string): boolean {
  // Check if token exists and is not expired
  const expirationTime = tokenStore.get(token);

  if (!expirationTime) {
    console.log('CSRF token validation failed: Token not found in store');
    return false; // Token not found
  }

  if (Date.now() > expirationTime) {
    // Token expired, remove it
    tokenStore.delete(token);
    console.log('CSRF token validation failed: Token expired');
    return false;
  }

  console.log('CSRF token validation successful, token is valid');
  return true;
}

/**
 * Remove expired tokens from the token store
 */
function cleanExpiredTokens(): void {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [token, expiration] of tokenStore.entries()) {
    if (now > expiration) {
      tokenStore.delete(token);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired CSRF tokens`);
    saveTokensToDisk();
  }
}

/**
 * Invalidate a token after use
 * @param token The token to invalidate
 */
export function invalidateToken(token: string): void {
  if (tokenStore.has(token)) {
    tokenStore.delete(token);
    saveTokensToDisk();
  }
}
