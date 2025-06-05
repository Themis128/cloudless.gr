/**
 * Vitest test setup file
 * This file runs before all test files and sets up the testing environment
 */

import { vi } from 'vitest'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local and .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

// Set fallback values for missing Supabase env vars
process.env.SUPABASE_URL ||= 'https://test.supabase.co'
process.env.SUPABASE_KEY ||= 'test-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'

// Log loaded env vars
console.log('[Test Setup] Loaded environment variables:')
console.log('[Test Setup] SUPABASE_URL:', process.env.SUPABASE_URL)
console.log('[Test Setup] SUPABASE_KEY:', process.env.SUPABASE_KEY?.slice(0, 6) + '...')

// Optional: mock fetch globally if needed
// WARNING: Mocking fetch can break real Supabase operations like auth
// Uncomment only if you're not using real Supabase calls in these tests
// global.fetch = vi.fn()

// Optional: mock window.location if needed for client-side Nuxt logic
if (typeof global.window === 'undefined') {
  Object.defineProperty(global, 'window', {
    value: {
      location: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
        pathname: '/',
        search: '',
        hash: '',
      },
    },
    writable: true,
  })
}

// Clean up all mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.resetAllMocks()
})

// Global test utilities
global.testUtils = {
  /**
   * Create a fake Supabase response object
   */
  mockSupabaseResponse: (data: any, error: any = null) => ({
    data,
    error,
    status: error ? 400 : 200,
    statusText: error ? 'Bad Request' : 'OK',
  }),

  /**
   * Temporarily override environment variables
   */
  mockEnv: (overrides: Record<string, string> = {}) => {
    const originalEnv = { ...process.env }
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_KEY: 'test-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      ...overrides,
    }
    return () => {
      process.env = originalEnv
    }
  },
}

// Type declarations for global test utilities
declare global {
  var testUtils: {
    mockSupabaseResponse: (data: any, error?: any) => any
    mockEnv: (overrides?: Record<string, string>) => () => void
  }
}
