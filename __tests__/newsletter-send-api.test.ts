import { beforeEach, describe, expect, it, vi } from "vitest";

const getConfigMock = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: getConfigMock,
  resetSsmCache: vi.fn(),
}));

const listNewsletterSubscribersMock = vi.fn();
vi.mock("@/lib/espocrm", () => ({
  listNewsletterSubscribers: listNewsletterSubscribersMock,
}));

const sendEmailMock = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: sendEmailMock,
}));

const SECRET = "test-newsletter-secret";

const VALID_BODY = {
  subject: "Weekly digest",
  html: "<p>Hello %UNSUBSCRIBELINK%</p>",
  text: "Hello %UNSUBSCRIBELINK%",
};

function makeRequest(
  body: unknown,
  headers: Record<string, string> = { "x-newsletter-secret": SECRET },
): Request {
  return new globalThis.Request("http://localhost:4000/api/newsletter/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/newsletter/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({ NEWSLETTER_SEND_SECRET: SECRET });
    listNewsletterSubscribersMock.mockResolvedValue([
      "a@cloudless.gr",
      "b@cloudless.gr",
    ]);
    sendEmailMock.mockResolvedValue(undefined);
  });

  it("returns 503 when the send secret is not configured", async () => {
    getConfigMock.mockResolvedValueOnce({ NEWSLETTER_SEND_SECRET: "" });
    const { POST } = await import("@/app/api/newsletter/send/route");
    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(503);
  });

  it("returns 401 when the secret header is wrong", async () => {
    const { POST } = await import("@/app/api/newsletter/send/route");
    const response = await POST(
      makeRequest(VALID_BODY, { "x-newsletter-secret": "nope" }),
    );
    expect(response.status).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 400 when subject/html/text are missing", async () => {
    const { POST } = await import("@/app/api/newsletter/send/route");
    const response = await POST(makeRequest({ subject: "only subject" }));
    expect(response.status).toBe(400);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON", async () => {
    const { POST } = await import("@/app/api/newsletter/send/route");
    const response = await POST(makeRequest("{not json"));
    expect(response.status).toBe(400);
  });

  it("sends to every subscriber and reports counts", async () => {
    const { POST } = await import("@/app/api/newsletter/send/route");
    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ sent: 2, failed: 0, total: 2 });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("substitutes the unsubscribe token per recipient", async () => {
    const { POST } = await import("@/app/api/newsletter/send/route");
    await POST(makeRequest(VALID_BODY));

    const firstCall = sendEmailMock.mock.calls[0][0];
    expect(firstCall.to).toBe("a@cloudless.gr");
    expect(firstCall.html).toContain("api/unsubscribe?email=a%40cloudless.gr");
    expect(firstCall.html).not.toContain("%UNSUBSCRIBELINK%");
    expect(firstCall.listUnsubscribeUrl).toContain("a%40cloudless.gr");
  });

  it("counts failed deliveries without aborting the batch", async () => {
    sendEmailMock
      .mockRejectedValueOnce(new Error("ses-throttled"))
      .mockResolvedValueOnce(undefined);
    const { POST } = await import("@/app/api/newsletter/send/route");
    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(data).toEqual({ sent: 1, failed: 1, total: 2 });
  });

  it("returns zero counts when there are no subscribers", async () => {
    listNewsletterSubscribersMock.mockResolvedValueOnce([]);
    const { POST } = await import("@/app/api/newsletter/send/route");
    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(data).toEqual({ sent: 0, failed: 0, total: 0 });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
