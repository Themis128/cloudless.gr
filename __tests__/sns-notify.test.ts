import { describe, it, expect, beforeEach, vi } from "vitest";

const mockSend = vi.fn();
const mockGetConfig = vi.fn();

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: vi.fn(function (this: { send: typeof mockSend }) {
    this.send = mockSend;
  }),
  PublishCommand: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: () => mockGetConfig(),
  resetSsmCache: vi.fn(),
}));

describe("sns-notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("publishPortalNotification", () => {
    it("returns false when SNS_PORTAL_TOPIC_ARN is not configured", async () => {
      mockGetConfig.mockResolvedValue({ SNS_PORTAL_TOPIC_ARN: "" });
      const { publishPortalNotification } = await import("@/lib/sns-notify");
      const ok = await publishPortalNotification({
        eventType: "comment_added",
        portalLabel: "Test Project",
        clientName: "Alice",
        clientEmail: "alice@example.com",
        title: "New comment from Alice",
        description: 'Step: Kickoff\nComment: Looks good!',
      });
      expect(ok).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("publishes to SNS with the correct payload", async () => {
      mockGetConfig.mockResolvedValue({
        SNS_PORTAL_TOPIC_ARN: "arn:aws:sns:us-east-1:123456789012:cloudless-portal-notifications",
      });
      mockSend.mockResolvedValue({ MessageId: "mocked-id" });

      const { publishPortalNotification } = await import("@/lib/sns-notify");
      const ok = await publishPortalNotification({
        eventType: "deliverable_action",
        portalLabel: "Acme Website",
        clientName: "Bob",
        clientEmail: "bob@acme.com",
        title: '[Portal] Bob approved: "Homepage design"',
        description: 'Bob approved ✅ "Homepage design" (Acme Website).',
        url: "https://cloudless.gr/portal/abc-123",
        metadata: { deliverableId: "d-1", action: "approve" },
      });

      expect(ok).toBe(true);
      expect(mockSend).toHaveBeenCalledOnce();
      const [cmd] = mockSend.mock.calls[0] as [{ input: { TopicArn: string; Subject: string; Message: string; MessageAttributes: unknown } }];
      expect(cmd.input.TopicArn).toBe(
        "arn:aws:sns:us-east-1:123456789012:cloudless-portal-notifications"
      );
      expect(cmd.input.Subject).toContain("Bob approved");
      expect(cmd.input.Subject.length).toBeLessThanOrEqual(100);
      const parsed = JSON.parse(cmd.input.Message);
      expect(parsed.eventType).toBe("deliverable_action");
      expect(parsed.clientEmail).toBe("bob@acme.com");
      expect(parsed.metadata?.deliverableId).toBe("d-1");
    });

    it("includes MessageAttributes for routing", async () => {
      mockGetConfig.mockResolvedValue({
        SNS_PORTAL_TOPIC_ARN: "arn:aws:sns:us-east-1:123456789012:cloudless-portal-notifications",
      });
      mockSend.mockResolvedValue({ MessageId: "mocked-id" });

      const { publishPortalNotification } = await import("@/lib/sns-notify");
      await publishPortalNotification({
        eventType: "comment_added",
        portalLabel: "Test",
        clientName: "Charlie",
        clientEmail: "c@test.com",
        title: "Comment",
        description: "Test comment",
      });

      const [cmd] = mockSend.mock.calls[0] as [{ input: { MessageAttributes: Record<string, { DataType: string; StringValue: string }> } }];
      expect(cmd.input.MessageAttributes.eventType.StringValue).toBe("comment_added");
      expect(cmd.input.MessageAttributes.portalLabel.StringValue).toBe("Test");
    });

    it("returns false when getConfig throws", async () => {
      mockGetConfig.mockRejectedValue(new Error("SSM unavailable"));

      const { publishPortalNotification } = await import("@/lib/sns-notify");
      const ok = await publishPortalNotification({
        eventType: "comment_added",
        portalLabel: "Test",
        clientName: "Dev",
        clientEmail: "dev@x.com",
        title: "Test",
        description: "Test",
      });
      expect(ok).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns false when SNS send fails", async () => {
      mockGetConfig.mockResolvedValue({
        SNS_PORTAL_TOPIC_ARN: "arn:aws:sns:us-east-1:123456789012:cloudless-portal-notifications",
      });
      mockSend.mockRejectedValue(new Error("SNS service error"));

      const { publishPortalNotification } = await import("@/lib/sns-notify");
      const ok = await publishPortalNotification({
        eventType: "comment_added",
        portalLabel: "Test",
        clientName: "Dev",
        clientEmail: "dev@x.com",
        title: "Test",
        description: "Test",
      });
      expect(ok).toBe(false);
    });

    it("truncates title to 100 chars for SNS Subject limit", async () => {
      mockGetConfig.mockResolvedValue({
        SNS_PORTAL_TOPIC_ARN: "arn:aws:sns:us-east-1:123456789012:cloudless-portal-notifications",
      });
      mockSend.mockResolvedValue({ MessageId: "mocked-id" });

      const longTitle = "A".repeat(200);
      const { publishPortalNotification } = await import("@/lib/sns-notify");
      await publishPortalNotification({
        eventType: "comment_added",
        portalLabel: "Test",
        clientName: "Dev",
        clientEmail: "dev@x.com",
        title: longTitle,
        description: "Test",
      });

      const [cmd] = mockSend.mock.calls[0] as [{ input: { Subject: string } }];
      expect(cmd.input.Subject.length).toBe(100);
    });
  });
});
