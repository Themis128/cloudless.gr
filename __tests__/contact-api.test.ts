import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn().mockResolvedValue({});

// Mock AWS SES before importing the route — use class syntax for constructor
vi.mock("@aws-sdk/client-ses", () => {
  return {
    SESClient: class MockSESClient {
      send = mockSend;
    },
    SendEmailCommand: class MockSendEmailCommand {
      constructor(public input: unknown) {}
    },
  };
});

// Mock SSM config
vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    SES_FROM_EMAIL: "test@cloudless.gr",
    SES_TO_EMAIL: "inbox@cloudless.gr",
    AWS_SES_REGION: "us-east-1",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_PUBLISHABLE_KEY: "pk_test_123",
  }),
}));

describe("POST /api/contact", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
    const mod = await import("@/app/api/contact/route");
    POST = mod.POST;
  });

  it("returns 400 when required fields are missing", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBeTruthy();
  });

  it("returns 200 with valid fields", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Themis",
        email: "themis@test.com",
        message: "Hello from tests",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("returns 200 with all optional fields included", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Themis",
        email: "themis@test.com",
        company: "Cloudless",
        service: "Cloud Architecture",
        message: "I need an audit",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
