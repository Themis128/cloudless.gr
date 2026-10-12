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

const mockAnalyzeLeadMessage = vi.fn();

vi.mock("@/lib/nlp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/nlp")>();
  mockAnalyzeLeadMessage.mockImplementation(actual.analyzeLeadMessage);
  return {
    ...actual,
    analyzeLeadMessage: (...args: unknown[]) => mockAnalyzeLeadMessage(...args),
  };
});

describe("POST /api/contact", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSendEmailResend.mockResolvedValue(undefined);
    const actual = await vi.importActual<typeof import("@/lib/nlp")>("@/lib/nlp");
    mockAnalyzeLeadMessage.mockImplementation(actual.analyzeLeadMessage);
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
    // Vitest sets NODE_ENV=test — contact route skips Resend in test/E2E.
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
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("still returns 200 when NLP analysis throws", async () => {
    mockAnalyzeLeadMessage.mockRejectedValueOnce(new Error("nlp boom"));
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Themis",
        email: "themis@test.com",
        message: "Hello even if NLP fails",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("returns 400 for oversized messages", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Themis",
        email: "themis@test.com",
        message: "x".repeat(15_000),
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockSendEmailResend).not.toHaveBeenCalled();
  });

  it("returns 400 for non-string field types", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: 42,
        email: "themis@test.com",
        message: ["a", "b"],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockSendEmailResend).not.toHaveBeenCalled();
  });
  it("returns 200 when attribution is a pre-parsed object (CLOUDLESS-GR-8)", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Themis",
        email: "themis@test.com",
        message: "Hello with object attribution",
        attribution: { utmSource: "google", utmMedium: "cpc" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("returns 400 for invalid attribution JSON string (CLOUDLESS-GR-8)", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Themis",
        email: "themis@test.com",
        message: "Hello with bad attribution",
        attribution: "{not-valid-json",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid attribution JSON.");
    expect(mockSendEmailResend).not.toHaveBeenCalled();
  });
});

// ── tail coverage: cookies, validation edges, email-fail, sentry, GET ──
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => {}),
  sendContactAcknowledgment: vi.fn(async () => {}),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn((cb: (s: { setTag: (k: string, v: string) => void }) => void) =>
    cb({ setTag: vi.fn() })
  ),
}));

import { sendEmail } from "@/lib/email";
import { getConfig } from "@/lib/ssm-config-d1";

const validBody = { name: "Pat", email: "pat@x.dev", message: "hello there" };
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("POST /api/contact — tail branches", () => {
  let POST2: (request: Request) => Promise<Response>;
  beforeEach(async () => {
    const mod = await import("@/app/api/contact/route");
    POST2 = mod.POST;
  });

  it("GET returns 405", async () => {
    const { GET } = await import("@/app/api/contact/route");
    expect(GET().status).toBe(405);
  });

  it("400 on invalid email format", async () => {
    const res = await POST2(post({ ...validBody, email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Invalid email");
  });

  it("400 on whitespace-only message", async () => {
    const res = await POST2(post({ ...validBody, message: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("whitespace");
  });

  it("400 on empty name", async () => {
    const res = await POST2(post({ ...validBody, name: "  " }));
    expect(res.status).toBe(400);
  });

  it("reads Meta click ids when marketing consent is set", async () => {
    const cookie =
      "cookieConsent=" + encodeURIComponent(JSON.stringify({ marketing: true })) +
      "; _fbp=fb.1.x; _fbc=fb.1.y";
    const res = await POST2(post(validBody, { cookie }));
    expect(res.status).toBe(200);
  });

  it("handles malformed consent cookie", async () => {
    const res = await POST2(post(validBody, { cookie: "cookieConsent=%7Bbad" }));
    expect(res.status).toBe(200);
  });

  it("handles marketing:false consent", async () => {
    const cookie = "cookieConsent=" + encodeURIComponent(JSON.stringify({ marketing: false }));
    const res = await POST2(post(validBody, { cookie }));
    expect(res.status).toBe(200);
  });
});

describe("sendAdminEmail + catch branches", () => {
  let POST2: (request: Request) => Promise<Response>;
  beforeEach(async () => {
    const mod = await import("@/app/api/contact/route");
    POST2 = mod.POST;
  });

  it("sends the admin email in production env", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await POST2(post(validBody));
    await vi.waitFor(() => expect(vi.mocked(sendEmail)).toHaveBeenCalled());
    vi.unstubAllEnvs();
  });

  it("logs the 503 response when email is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("resend not configured"));
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await POST2(post(validBody));
    expect(res.status).toBe(200);
    await vi.waitFor(() =>
      expect(spy).toHaveBeenCalledWith("[Contact] Admin email returned:", 503)
    );
    spy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("rethrows generic email errors into the rejected-task log", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("smtp exploded"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST2(post(validBody));
    expect(res.status).toBe(200);
    await vi.waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("[Contact] Background task"),
        expect.any(Error)
      )
    );
    spy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("500 + Sentry when the synchronous flow throws", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://dsn";
    vi.mocked(getConfig).mockRejectedValueOnce(new Error("d1 gone"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST2(post(validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("Failed to process");
    await vi.waitFor(async () => {
      const sentry = await import("@sentry/nextjs");
      expect(vi.mocked(sentry.captureException)).toHaveBeenCalled();
    });
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    spy.mockRestore();
  });
});
