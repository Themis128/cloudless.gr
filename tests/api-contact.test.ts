// tests/api-contact.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { H3Event } from 'h3';
import type { Mock } from 'vitest';

// Mock the h3 module
vi.mock('h3', () => {
  return {
    defineEventHandler: (fn: any) => fn,
    getCookie: vi.fn(),
    readBody: vi.fn(),
    getRequestIP: vi.fn(),
  };
});

// Import mocked functions
import { getCookie, readBody, getRequestIP } from 'h3';

// Mock prisma client
vi.mock('../server/utils/prisma', () => {
  return {
    __esModule: true,
    default: {
      contactSubmission: {
        create: vi.fn().mockResolvedValue({
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          subject: 'Test Subject',
          message: 'Test Message',
          createdAt: new Date(),
          status: 'new',
          metadata:
            '{"ip":"127.0.0.1","userAgent":"test","referrer":"test","submissionTime":"2023-01-01T00:00:00.000Z"}',
        }),
      },
    },
  };
});

// Mock CSRF protection utilities
vi.mock('../server/utils/csrf-protection', () => {
  return {
    validateCsrfToken: vi.fn().mockReturnValue(true),
    invalidateToken: vi.fn(),
  };
});

// Mock rate limiter functions
vi.mock('../server/utils/rate-limiter', () => {
  return {
    checkRateLimit: vi.fn().mockReturnValue(true),
    getRemainingSubmissions: vi.fn().mockReturnValue(10),
    getTimeUntilReset: vi.fn().mockReturnValue(3600000),
  };
});

// Import dependencies to access their mocked implementations
const { validateCsrfToken } = await import('../server/utils/csrf-protection');
const prisma = await import('../server/utils/prisma');
const { checkRateLimit } = await import('../server/utils/rate-limiter');

// Import the handler AFTER setting up all mocks
let handler: any;

// Create a mock event
const createMockEvent = (bodyOverride?: Record<string, any>, cookieToken?: string): H3Event => {
  const reqHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'cookie': cookieToken ? `csrf_token=${cookieToken}` : '',
  };
  return {
    node: {
      req: { method: 'POST', headers: reqHeaders },
      res: { setHeader: vi.fn(), statusCode: 200, end: vi.fn() }
    },
    context: { ip: '127.0.0.1' },
    req: { method: 'POST', headers: reqHeaders },
    res: { setHeader: vi.fn(), statusCode: 200, end: vi.fn() },
    path: '/api/contact',
    _testBody: bodyOverride,
  } as unknown as H3Event;
};

// Patch h3 mocks to use event._testBody and event.req.headers
(getCookie as Mock).mockImplementation((event: H3Event, name: string) => {
  if (name === 'csrf_token') {
    const cookieHeader = event?.node?.req?.headers?.cookie || event?.req?.headers?.cookie || '';
    const match = /csrf_token=([^;]+)/.exec(cookieHeader);
    return match ? match[1] : '';
  }
  return '';
});

(readBody as Mock).mockImplementation((event: H3Event) => {
  // Always return the body attached to the event
  return Promise.resolve((event as any)._testBody || {});
});

(getRequestIP as Mock).mockImplementation((event: H3Event) => event.context?.ip || '127.0.0.1');

describe('Contact API Endpoint', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Import handler only after mocks are set up
    const { default: contactHandler } = await import('../server/api/contact');
    handler = contactHandler;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('validates form input and returns success', async () => {
    const body = {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'Test Message',
      csrfToken: 'valid-token',
    };
    const event = createMockEvent(body, 'valid-token');
    const response = await handler(event);
    expect(response.status).toBe('success');
    expect(response.submissionId).toBe(1);
  });

  test('rejects requests with invalid CSRF token', async () => {
    vi.mocked(validateCsrfToken).mockReturnValue(false);
    const body = {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'Test Message',
      csrfToken: 'invalid-token',
    };
    const event = createMockEvent(body, 'invalid-token');
    const response = await handler(event);
    expect(response.status).toBe('error');
    expect(response.message).toContain('expired or is invalid');
  });

  test('rejects requests where honeypot field is filled', async () => {
    const body = {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'Test Message',
      website: 'spam.com',
      csrfToken: 'valid-token',
    };
    const event = createMockEvent(body, 'valid-token');
    const response = await handler(event);
    expect(response.status).toBe('success');
    expect(response.submissionId).toBeDefined();
    expect(vi.mocked(prisma).default.contactSubmission.create).not.toHaveBeenCalled();
  });

  test('rejects requests with missing required fields', async () => {
    const body = {
      name: '',
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'Test Message',
      csrfToken: 'valid-token',
    };
    const event = createMockEvent(body, 'valid-token');
    const response = await handler(event);
    expect(response.status).toBe('error');
    expect(response.message).toBe('All fields are required');
  });

  test('rejects requests with invalid email', async () => {
    const body = {
      name: 'Test User',
      email: 'invalid-email',
      subject: 'Test Subject',
      message: 'Test Message',
      csrfToken: 'valid-token',
    };
    const event = createMockEvent(body, 'valid-token');
    const response = await handler(event);
    expect(response.status).toBe('error');
    expect(response.message).toContain('valid email');
  });

  test('successfully creates contact submission with metadata', async () => {
    const body = {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'Test Message',
      csrfToken: 'valid-token',
    };
    const event = createMockEvent(body, 'valid-token');
    const response = await handler(event);
    expect(response.status).toBe('success');
    expect(response.submissionId).toBe(1);
    expect(vi.mocked(prisma).default.contactSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Test User',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test Message',
        metadata: expect.stringContaining('127.0.0.1'),
      }),
    });
  });
});
