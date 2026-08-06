import { timingSafeEqual } from 'node:crypto';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Mock the getConfig function to return the CRON_SECRET from .env
const mockGetConfig = async () => {
  return { CRON_SECRET: process.env.CRON_SECRET };
};

// Mock the request object
const mockRequest = (authorizationHeader) => {
  return {
    headers: {
      get: (name) => {
        if (name.toLowerCase() === 'authorization') {
          return authorizationHeader;
        }
        return null;
      }
    }
  };
};

// Copy the safeEqual and isCronAuthorized functions from cron-auth.ts
const BEARER_PREFIX = "Bearer ";

function safeEqual(a, b) {
  const aBuf = Buffer.from(a, "utf-8");
  const bBuf = Buffer.from(b, "utf-8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function isCronAuthorized(request) {
  const config = await mockGetConfig();
  const expected = config.CRON_SECRET || process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) return false;
  return safeEqual(header.slice(BEARER_PREFIX.length), expected);
}

// Test with the token from .env
const token = process.env.CRON_SECRET;
console.log('Token from env:', token);
console.log('Token length:', token.length);

const authHeader = `Bearer ${token}`;
console.log('Auth header:', authHeader);

const request = mockRequest(authHeader);

isCronAuthorized(request).then(result => {
  console.log('Authorization result:', result);
}).catch(err => {
  console.error('Error:', err);
});
