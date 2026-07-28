import { vi } from 'vitest';

// Mock implementations for AWS SDK clients that redirect to Cloudflare equivalents
// These mocks prevent test failures by replacing AWS service calls with no-op equivalents
// that resolve immediately, allowing tests to proceed in the Cloudflare environment

// Generic mock class template
class AwsMock {
  constructor() {}
  // Resolve any method call to avoid test failures
  send(request: any): Promise<any> {
    return Promise.resolve({});
  }
}

// Mock for AWS SDK clients used in the codebase
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: AwsMock,
}));

vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: AwsMock,
}));

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: AwsMock,
}));

vi.mock('@aws-sdk/client-sesv2', () => ({
  SES2Client: AwsMock,
}));

vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: AwsMock,
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: AwsMock,
}));

vi.mock('@aws-sdk/client-athena', () => ({
  AthenaClient: AwsMock,
}));

vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: AwsMock,
}));

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: AwsMock,
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: AwsMock,
}));

vi.mock('@aws-sdk/client-iam', () => ({
  IAMClient: AwsMock,
}));

// Additional AWS SDK mocks can be added here as needed
// For any new AWS service imports, add a corresponding mock above

// Optional: Add a general fallback mock for any AWS module not explicitly listed
vi.mock('@aws-sdk/*', () => {
  const mock = new AwsMock();
  return {
    default: mock,
  };
});

// Ensure all mocked clients are instantiated only when used
// This prevents unnecessary initialization overhead during test setup
const mockInstances = new Map();

function getMock(moduleName: string): AwsMock {
  if (!mockInstances.has(moduleName)) {
    const MockClass: any = vi.hooked(() => {
      return new AwsMock();
    });
    mockInstances.set(moduleName, MockClass);
  }
  return mockInstances.get(moduleName);
}

// Example of dynamic mock resolution (if needed for deeper integration)
// This allows the setup to adapt to any AWS module path encountered during tests
vi.mockFetch('*', async (req, res, options) => {
  // This is a placeholder for any additional fetch-based mocking
  // that might be required for AWS service endpoints
  return res(options.body || {});
});