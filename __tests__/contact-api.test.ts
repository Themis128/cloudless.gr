import { describe, it, expect, vi, beforeEach } from "vitest";

// Bypass rate limiting in unit tests — we test the limiter separately
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 99 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
  resetRateLimitStore: vi.fn(),
}));

const mockSendEmailResend = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/email-resend", () => ({
  isResendConfigured: vi.fn(() => true),
  sendEmailResend: (...args: unknown[]) => mockSendEmailResend(...args),
}));

vi.mock("@/lib/ssm-config-d1", () => ({
  getConfig: vi.fn().mockResolvedValue({
    SES_TO_EMAIL: "team@cloudless.gr",
  }),
}));

describe("POST /api/contact", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSendEmailResend.mockResolvedValue(undefined);
    const { isResendConfigured } = await import("@/lib/email-resend");
    vi.mocked(isResendConfigured).mockReturnValue(true);
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

  it("returns 400 on a malformed JSON body without sending email (CLOUDLESS-GR-3)", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "-not valid json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("Invalid request body.");
    // A malformed body must short-circuit before any email work.
    expect(mockSendEmailResend).not.toHaveBeenCalled();
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
    expect(mockSendEmailResend).toHaveBeenCalled();
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
    expect(mockSendEmailResend).toHaveBeenCalled();
  });
});
