import { test, expect } from '@playwright/test';
import { setupTestEnv } from '../setup';

test.describe('API Invalid Input Tests', () => {
  test.beforeAll(async () => {
    await setupTestEnv();
  });

  test('should reject invalid login credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      json: {
        email: 'invalid-email',
        password: 'short'
      }
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'Invalid credentials'
    });
  });

  test('should reject weak password during registration', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      json: {
        email: 'test@example.com',
        password: 'weak',
        name: 'Test User'
      }
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'Password must be at least 8 characters'
    });
  });

  test('should reject empty contact form submission', async ({ request }) => {
    const response = await request.post('/api/contact', {
      json: {
        name: '',
        email: '',
        message: ''
      }
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'All fields are required'
    });
  });

  // Additional tests for other endpoints...
});