import { vi } from 'vitest';

export const AwsMock = {
  send: vi.fn().mockResolvedValue({}),
  getObject: vi.fn().mockResolvedValue({
    Body: Buffer.from('{"mock": "data"}'),
  }),
  putObject: vi.fn().mockResolvedValue({}),
  deleteObject: vi.fn().mockResolvedValue({}),
  listObjectsV2: vi.fn().mockResolvedValue({
    Contents: [{ Key: 'mock-object' }],
  }),
  listObjects: vi.fn().mockResolvedValue({
    Contents: [{ Key: 'mock-object' }],
  }),
  headObject: vi.fn().mockResolvedValue({}),
  uploadPart: vi.fn().mockResolvedValue({}),
  completeMultipartUpload: vi.fn().mockResolvedValue({}),
  createMultipartUpload: vi.fn().mockResolvedValue({}),
  abortMultipartUpload: vi.fn().mockResolvedValue({}),
};

export const S3Client = vi.fn().mockImplementation(() => AwsMock);
export const DynamoDBClient = vi.fn().mockImplementation(() => AwsMock);
export const LambdaClient = vi.fn().mockImplementation(() => ({
  invoke: vi.fn().mockResolvedValue({}),
}));