import { vi } from "vitest";
import { AwsMock, GetParameterCommand, PutParameterCommand, SSMClient } from "./aws-mock";

// Mock for AWS SDK clients still used in the codebase (Wave B leftovers)
export default async () => {
  vi.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: AwsMock,
  }));

  vi.mock("@aws-sdk/client-ssm", () => ({
    SSMClient,
    GetParameterCommand,
    PutParameterCommand,
  }));

  vi.mock("next-intl", () => ({
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }));
};
