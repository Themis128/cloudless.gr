import { vi } from 'vitest';
import { AwsMock } from './aws-mock';

// Mock for AWS SDK clients used in the codebase
export default async () => {
  vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: AwsMock,
  }));

  vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: AwsMock,
  }));

  vi.mock('next-intl', () => ({
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }));
};