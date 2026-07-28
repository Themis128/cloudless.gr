import { vi } from 'vitest';
import { createMock } from 'vitest';

// Global mocks for common modules
vi.mock('next/server', () => ({
  // Mock implementations for Next.js server components
}));

vi.mock('aws-sdk', () => ({
  // Mock implementations for AWS SDK
  S3: createMock<typeof S3>(),
  DynamoDB: createMock<typeof DynamoDB>(),
  Lambda: createMock<typeof Lambda>(),
}));

// Global setup for all tests
beforeAll(() => {
  // Set up any global test environment here
});

afterAll(() => {
  // Clean up after all tests
});