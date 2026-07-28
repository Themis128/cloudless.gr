import { test, expect } from '@playwright/test';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, optionalAuth } from '@/lib/auth-middleware';
import { mockRequest } from './utils/mock-request';

test.describe('Auth Middleware Tests', () => {
  test('requireAuth should redirect unauthenticated users', async () => {
    const request = mockRequest({ url: 'http://example.com/api/test' });
    const response = await requireAuth(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(302);
    expect(response.url).toBe('http://example.com/auth/login');
  });

  test('requireAuth should allow authenticated users', async () => {
    const request = mockRequest({
      url: 'http://example.com/api/test',
      headers: { 'x-auth-user': '123' }
    });
    const response = await requireAuth(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
  });

  test('requireAdmin should redirect non-admin users', async () => {
    const request = mockRequest({
      url: 'http://example.com/api/admin',
      headers: { 'x-auth-user': '123' }
    });
    const response = await requireAdmin(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(302);
    expect(response.url).toBe('http://example.com/auth/login');
  });

  test('requireAdmin should allow admin users', async () => {
    const request = mockRequest({
      url: 'http://example.com/api/admin',
      headers: { 'x-auth-user': '123', 'x-auth-role': 'admin' }
    });
    const response = await requireAdmin(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
  });

  test('optionalAuth should add user ID to headers', async () => {
    const request = mockRequest({
      url: 'http://example.com/api/test',
      headers: { 'x-auth-user': '123' }
    });
    const response = await optionalAuth(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-auth-user')).toBe('123');
  });
});