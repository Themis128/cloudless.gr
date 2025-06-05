/**
 * Vitest test setup file
 * This file runs before all test files and sets up the testing environment
 */

import { vi } from 'vitest';

// Mock environment variables for testing
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || 'test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

// Mock console methods to reduce noise in tests (optional)
global.console = {
  ...console,
  // Keep error and warn for debugging
  // log: vi.fn(),
  // info: vi.fn(),
  // debug: vi.fn(),
};

// Mock fetch globally for HTTP requests
global.fetch = vi.fn();

// Mock window object if needed for browser-specific tests
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
  },
  writable: true,
});

// Setup for Nuxt/Vue testing
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  vi.resetAllMocks();
});

// Global test utilities
global.testUtils = {
  // Helper to create mock Supabase responses
  mockSupabaseResponse: (data: any, error: any = null) => ({
    data,
    error,
    status: error ? 400 : 200,
    statusText: error ? 'Bad Request' : 'OK',
  }),
  
  // Helper to create mock environment
  mockEnv: (overrides: Record<string, string> = {}) => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_KEY: 'test-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      ...overrides,
    };
    return () => {
      process.env = originalEnv;
    };
  },
};

// Type declarations for TypeScript
declare global {
  var testUtils: {
    mockSupabaseResponse: (data: any, error?: any) => any;
    mockEnv: (overrides?: Record<string, string>) => () => void;
  };
}

console.log('✅ Test setup completed successfully');
