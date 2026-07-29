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

// Minimal in-memory mock for SSM Parameters used by E2E specs.
// This specifically unblocks admin routes that persist to SSM
// (client-portals is the first one hit by the suite).
const ssmParams = new Map<string, string>();

export class GetParameterCommand {
  input: { Name?: string };
  constructor(input: { Name?: string }) {
    this.input = input;
  }
}

export class PutParameterCommand {
  input: { Name?: string; Value?: string };
  constructor(input: { Name?: string; Value?: string }) {
    this.input = input;
  }
}

export const SSMClient = vi.fn().mockImplementation(() => ({
  send: vi.fn(async (cmd: unknown) => {
    // The route code uses `new GetParameterCommand()` / `new PutParameterCommand()`
    // from the same mocked module, so instance checks are safe.
    if (cmd instanceof GetParameterCommand) {
      const name = cmd.input.Name ?? "";
      return { Parameter: { Value: ssmParams.get(name) ?? "[]" } };
    }

    if (cmd instanceof PutParameterCommand) {
      const name = cmd.input.Name ?? "";
      const value = cmd.input.Value ?? "";
      ssmParams.set(name, value);
      return {};
    }

    return {};
  }),
}));