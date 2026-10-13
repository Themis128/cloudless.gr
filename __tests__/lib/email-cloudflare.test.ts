import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isCloudflareEmailConfigured, sendEmailCloudflare } from "@/lib/email-cloudflare";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal("fetch", mockFetch);
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_EMAIL_API_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isCloudflareEmailConfigured", () => {
  it("returns false when both env vars are missing", () => {
    expect(isCloudflareEmailConfigured()).toBe(false);
  });

  it("returns false when only CLOUDFLARE_ACCOUNT_ID is set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    expect(isCloudflareEmailConfigured()).toBe(false);
  });

  it("returns false when only CLOUDFLARE_EMAIL_API_TOKEN is set", () => {
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token123";
    expect(isCloudflareEmailConfigured()).toBe(false);
  });

  it("returns true when both env vars are set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token123";
    expect(isCloudflareEmailConfigured()).toBe(true);
  });
});

describe("sendEmailCloudflare", () => {
  const opts = {
    to: "user@example.com",
    subject: "Hello",
    html: "<p>Hello</p>",
    text: "Hello",
  };

  it("throws when env vars are not configured", async () => {
    await expect(sendEmailCloudflare(opts)).rejects.toThrow(
      /CLOUDFLARE_ACCOUNT_ID/
    );
  });

  it("sends POST to Cloudflare API with correct payload", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token-abc";

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    await sendEmailCloudflare(opts);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.lastCall as [string, RequestInit];
    expect(url).toContain("acct123");
    expect(url).toContain("email/sending/send");
    const body = JSON.parse(init.body as string);
    expect(body.to).toBe("user@example.com");
    expect(body.subject).toBe("Hello");
  });

  it("includes reply_to when replyTo is set", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token-abc";

    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });

    await sendEmailCloudflare({ ...opts, replyTo: ["reply@example.com"] });

    const [, init] = mockFetch.mock.lastCall as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.reply_to).toBe("reply@example.com");
  });

  it("includes List-Unsubscribe header when listUnsubscribeUrl is set", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token-abc";

    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });

    await sendEmailCloudflare({ ...opts, listUnsubscribeUrl: "https://cloudless.gr/unsub" });

    const [, init] = mockFetch.mock.lastCall as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.headers["List-Unsubscribe"]).toContain("cloudless.gr");
  });
});

describe("sendEmailCloudflare error tails", () => {
  const opts = { to: "u@x.dev", subject: "s", html: "<p>x</p>", text: "x" };

  it("throws the API error message on an unsuccessful response", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token-abc";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ success: false, errors: [{ message: "bad token" }] }),
    });
    await expect(sendEmailCloudflare(opts)).rejects.toThrow("bad token");
  });

  it("falls back to the HTTP status when errors[] is absent", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token-abc";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false }),
    });
    await expect(sendEmailCloudflare(opts)).rejects.toThrow("HTTP 500");
  });

  it("throws on permanent bounces in the result", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token-abc";
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: { permanent_bounces: ["bounce@x.dev"] },
      }),
    });
    await expect(sendEmailCloudflare(opts)).rejects.toThrow("permanent bounce");
  });
});
